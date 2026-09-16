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

    /* ══ v931 · LA PROCEDENCIA PARTIDA EN TRES FECHAS ══════════════════
       `cuando` a secas juntaba la fecha del ACTO con la de haber conseguido
       el papel, y un Acuerdo de 2011 traído ayer se guardaba con la fecha de
       ayer. Lo que se mide acá es que cada una entre por su sitio y que la
       obligatoria —la del acto— no se pueda saltar. */
    const G = (est, f, valor) => R.guardarEntradaCampo(o.llave,
      { hueco: 'norma-urbana', estado: est, valor: valor || { io: 0.6 }, fuente: f });

    o.sinFechaDoc = G('confirmado', { como: 'tramite', quien: 'Curaduría Segunda de Cúcuta' });
    /* Texto libre donde va una fecha. Sin esta guarda, `vigenciaHasta` se
       compararía contra «hace tiempo» y el vencimiento fallaría en silencio,
       que es lo que este módulo lleva veinte tandas evitando. */
    o.fechaEnProsa = G('confirmado',
      { como: 'tramite', quien: 'Curaduría Segunda de Cúcuta', fechaDoc: 'hace tiempo' });
    /* Un POT que solo se conoce por su año: la precisión se acepta como
       venga, la FORMA no. */
    o.soloAnio = R.fechaDeDato('2011');
    o.prosaNoEsFecha = R.fechaDeDato('hace tiempo');

    /* Un BORRADOR admite procedencia a medias: es lo que lleva quien está a
       mitad de una plantilla y todavía no fue por el papel. Con la regla de
       la v929 —procedencia entera en los dos estados— el borrador no servía
       para nada y los dos estados significaban lo mismo. */
    o.borradorAMedias = G('borrador', { como: 'campo' }, { io: 0.6 });
    /* Que el sector tenga campo acá NO dice nada: los edificios ya lo
       habilitaron. Lo que se mide es que el borrador no entre en la lista de
       fuentes —o sea, que no sostenga ninguna cifra—. */
    o.borradorEnFuentes = (R.tieneCampo(o.llave).fuentes || [])
      .some(f => f.clase === 'hueco' && f.hueco === 'norma-urbana');

    /* ── La vigencia vencida DECLARA, no bloquea ────────────────────────
       Es la decisión de la v886 con los mapas de 6,5 cm y la de la v890 con
       el aviso de escala: quien analiza decide, la hoja dice. */
    o.vencida = G('confirmado', { como: 'tramite', quien: 'Curaduría Segunda de Cúcuta',
      fechaDoc: '2011-12-14', fechaObtencion: '2024-03-01', vigenciaHasta: '2024-09-01',
      docto: 'Acuerdo 089 de 2011' }, { io: 0.6, ic: 2, pisos: 4 });
    const tcV = R.tieneCampo(o.llave);
    o.vencidaCuenta = tcV.hay;
    o.vencidaTexto = R.textoDeProcedencia(tcV);

    /* Y una vigente, para que la rama contraria también se ejercite: medir
       solo la vencida dejaría pasar un «VENCIDO» puesto en todas partes. */
    o.vigente = G('confirmado', { como: 'tramite', quien: 'Curaduría Segunda de Cúcuta',
      fechaDoc: '2011-12-14', fechaObtencion: '2026-09-15', vigenciaHasta: '2099-01-01',
      docto: 'Acuerdo 089 de 2011' }, { io: 0.6, ic: 2, pisos: 4 });
    o.vigenteTexto = R.textoDeProcedencia(R.tieneCampo(o.llave));

    /* ── UNA ENTRADA ESCRITA POR LA v929 ────────────────────────────────
       Se planta en el almacén tal como la dejó aquella versión. No es
       alcanzar el estado por un lado: es exactamente lo que hay en el
       teléfono de quien guardó algo antes de esta tanda, y no hay otra forma
       de ejercitar una migración que teniendo el dato viejo delante. */
    const CK = 'pcr_campo_v1';
    const g = JSON.parse(localStorage.getItem(CK) || '{}');
    g[o.llave] = { v: 1, entradas: [{ id: 'vieja1', hueco: 'movilidad-real',
      estado: 'confirmado', valor: { x: 1 },
      fuente: { como: 'tramite', quien: 'Secretaría de Movilidad', cuando: '2026-09-10',
                docto: 'Oficio 1234' }, ts: Date.now() }] };
    localStorage.setItem(CK, JSON.stringify(g));
    const tcVieja = R.tieneCampo(o.llave);
    o.viejaCuenta = tcVieja.hay;
    o.viejaTexto = R.textoDeProcedencia(tcVieja);
    o.viejaFuente = (tcVieja.fuentes || []).filter(f => f.clase === 'hueco')
      .map(f => ({ fechaDoc: f.fechaDoc, sinDistinguir: f.fechaSinDistinguir }))[0] || null;
    localStorage.removeItem(CK);

    /* ══ v931 · LA MIGRACIÓN DE LOS ÍNDICES NO ASCIENDE SOLA ═══════════
       El caso viejo, montado por el camino de verdad: se dibuja un lote con
       los botones y se escriben los tres índices en sus casillas, que es lo
       que hace un estudiante. Eso deja `S.indicesPuestos` puesto y
       `S.indicesFuente` vacío — exactamente la ficha que existe hoy en los
       teléfonos, de antes de que la norma tuviera puerta de campo. */
    const bPest = h => hojaEl().querySelector('[data-pcr="pestana"][data-p="' + h + '"]');
    const pl0 = bPest('lote'); if (pl0) { pl0.click(); await esperar(500); }
    const bd = hojaEl().querySelector('[data-pcr="lote-dibujar"]');
    if (bd) { bd.click(); await esperar(500); }
    window.map.setView([C.lat, C.lng], 19); await esperar(400);
    const LOTE = [{ lat: C.lat - 0.00025, lng: C.lng - 0.00025 },
                  { lat: C.lat + 0.00025, lng: C.lng - 0.00025 },
                  { lat: C.lat + 0.00025, lng: C.lng + 0.00025 },
                  { lat: C.lat - 0.00025, lng: C.lng + 0.00025 }];
    for (const p of LOTE) { window.map.fire('click', { latlng: p }); await esperar(60); }
    const bcl = document.querySelector('#pcr-lote-barra [data-lote="cerrar"]');
    if (bcl) { bcl.click(); await esperar(900); }
    window.map.setView([C.lat, C.lng], 15); await esperar(300);
    R.abrir(); await esperar(400);
    const pl = bPest('lote'); if (pl) { pl.click(); await esperar(500); }
    ['io', 'ic', 'pisos'].forEach(id => {
      const el = hojaEl().querySelector('[data-pcr-idx="' + id + '"]');
      if (el) { el.value = String(Number(el.value) || 1);
                el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await esperar(600);
    o.indicesPuestos = ((R.estado() || {}).indicesPuestos || []).slice().sort().join(',');

    /* Los tres índices están escritos y NO hay con qué defenderlos. */
    o.migSinFuente = R.normaDesdeIndices();

    /* Y ahora con lo que una ficha vieja SÍ podía llevar: documento y año.
       Sigue sin poder ascender, porque el esquema viejo no tiene dónde
       guardar QUIÉN responde por el dato — y derivarlo del documento sería
       inventar procedencia, que es la falta que la v930 no cometió. */
    ['documento', 'fecha', 'tratamiento'].forEach((k, i) => {
      const el = hojaEl().querySelector('[data-pcr-fuente="' + k + '"]');
      if (el) { el.value = ['Acuerdo 089 de 2011', '2011', 'Consolidación'][i];
                el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await esperar(600);
    o.migConDocumento = R.normaDesdeIndices();

    /* La otra mitad: si alguien fuerza la entrada que la migración propone,
       el almacén tiene que rechazarla igual. Una guarda sola falla abierto. */
    o.migForzada = o.migConDocumento && o.migConDocumento.entrada
      ? R.guardarEntradaCampo(o.llave,
          Object.assign({}, o.migConDocumento.entrada, { estado: 'confirmado' }))
      : { ok: null, error: '(la migración no propuso ninguna entrada)' };

    /* ── Y LA PUERTA, cuando una persona SÍ completa la procedencia ─────
       La otra mitad de la guarda: si solo se midiera el rechazo, un «falta»
       puesto en todas partes pasaría en verde y la puerta no serviría. */
    o.botonAntes = !!hojaEl().querySelector('[data-pcr="norma-confirmar"]');
    o.avisoFalta = txt(hojaEl().querySelector('.pcr-cabe-fuente .pcr-ojo'));
    const elQ = hojaEl().querySelector('[data-pcr-fuente="quien"]');
    if (elQ) { elQ.value = 'Curaduría Urbana Segunda de Cúcuta';
               elQ.dispatchEvent(new Event('change', { bubbles: true })); }
    await esperar(600);
    o.migCompleta = R.normaDesdeIndices();
    const bn = hojaEl().querySelector('[data-pcr="norma-confirmar"]');
    o.botonDespues = !!bn;
    if (bn) { bn.click(); await esperar(700); }
    const tcN = R.tieneCampo(o.llave);
    o.normaGuardada = (tcN.fuentes || []).some(f => f.clase === 'hueco' && f.hueco === 'norma-urbana');
    o.normaTexto = R.textoDeProcedencia(tcN);
    /* Y la entrada guardada no lleva el nombre del documento donde va quién
       responde: lo que se guardó es lo que una persona escribió. */
    o.normaEntrada = (R.leerCampo(o.llave) || [])
      .filter(x => x.hueco === 'norma-urbana')
      .map(x => ({ estado: x.estado, quien: x.fuente.quien, fechaDoc: x.fuente.fechaDoc,
                   docto: x.fuente.docto, valor: x.valor }))[0] || null;

    /* ── UN POST-SECTOR CERRADO POR PAPEL, NO POR PUNTOS ────────────────
       Con la puerta de la norma abierta, un sector puede pasar a post-sector
       sin un solo punto levantado: el estudiante fue a la curaduría y no ha
       salido a mapear. Ahí el aviso de la v929 —«lo levantado en campo ya
       estaba todo publicado»— es falso por los dos lados. Se quitan los
       puntos, que es exactamente ese caso, y se mira lo que dice la pantalla.
       Sin esto la rama no se ejercitaría en ninguna prueba. */
    /* Se lee de la procedencia que se capturó cuando la corrida post CORRIÓ
       con los edificios (`o.procedencia`), no de `estado()` en este punto:
       confirmar la norma suelta `S.corridas.post` a propósito, así que acá
       `S.resultado` vuelve a ser el análisis de sector y no lleva ninguna.
       Medirlo aquí daba `false` por un motivo ajeno a lo que la aserción
       dice — la misma trampa del momento de la v895. */
    window.urbisDatosVisibles = function () { return []; };
    const bp2 = botonCorrida('post');
    if (bp2 && !bp2.disabled) { bp2.click(); await esperar(2500); }
    const ep = R.estado() || {};
    o.soloPapel = {
      corrida: ep.corrida,
      porPuntos: !!((ep.campoProcedencia || {}).porPuntos),
      texto: txt(hojaEl().querySelector('.pcr-corrida'))
    };

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
  /* Cita el texto de AHORA: desde la v931 la procedencia pide quién responde
     y la fecha del documento, no un «cuándo» que juntaba dos fechas. Una
     prueba que cita la interfaz tiene que citar la de ahora (v878). */
  T('una entrada sin procedencia se rechaza, y dice qué falta',
    r.rechazaSinFuente && r.rechazaSinFuente.ok === false &&
      /quién responde/i.test(r.rechazaSinFuente.error || '') &&
      /fecha del documento/i.test(r.rechazaSinFuente.error || ''),
    (r.rechazaSinFuente && r.rechazaSinFuente.error || '').slice(0, 110));
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

  console.log('\n  -- v931 · la fecha de un dato no es una sola fecha --');
  T('una confirmada sin la fecha del documento se rechaza',
    r.sinFechaDoc && r.sinFechaDoc.ok === false && /fecha del documento/i.test(r.sinFechaDoc.error || ''),
    (r.sinFechaDoc && r.sinFechaDoc.error || '').slice(0, 96));
  /* Sin esta, `vigenciaHasta` se compararía contra texto libre y el
     vencimiento fallaría en silencio. */
  T('y una fecha escrita en prosa tampoco pasa, diciendo qué forma se espera',
    r.fechaEnProsa && r.fechaEnProsa.ok === false && /2011-12-14|forma de fecha/i.test(r.fechaEnProsa.error || ''),
    (r.fechaEnProsa && r.fechaEnProsa.error || '').slice(0, 110));
  T('la precisión se acepta como venga —un POT por su año— y la prosa no',
    r.soloAnio === '2011' && r.prosaNoEsFecha === null,
    'año=' + JSON.stringify(r.soloAnio) + ' · prosa=' + JSON.stringify(r.prosaNoEsFecha));
  T('un borrador SÍ admite procedencia a medias, y no sostiene ninguna cifra',
    r.borradorAMedias && r.borradorAMedias.ok === true && r.borradorEnFuentes === false,
    'guardado=' + (r.borradorAMedias && r.borradorAMedias.ok) +
      ' · entra en las fuentes=' + r.borradorEnFuentes);

  console.log('\n  -- la vigencia vencida declara, no bloquea --');
  T('una fuente vencida se guarda, cuenta, y lo DICE',
    r.vencida && r.vencida.ok === true && r.vencidaCuenta === true &&
      /VENCIDO/.test(r.vencidaTexto || ''),
    (r.vencidaTexto || '').slice(0, 130));
  /* La rama contraria, o un «VENCIDO» puesto en todas partes pasaría igual. */
  T('y una vigente no se marca vencida',
    r.vigente && r.vigente.ok === true &&
      !/VENCIDO/.test(r.vigenteTexto || '') && /vigente hasta/.test(r.vigenteTexto || ''),
    (r.vigenteTexto || '').slice(0, 130));
  T('las tres fechas salen impresas por lo que cada una es',
    /del 2011-12-14/.test(r.vigenteTexto || '') && /conseguido el 2026-09-15/.test(r.vigenteTexto || ''),
    (r.vigenteTexto || '').slice(0, 160));

  console.log('\n  -- una entrada de la v929 no se asciende al esquema nuevo --');
  T('la entrada vieja se sigue leyendo y contando', r.viejaCuenta === true, 'cuenta=' + r.viejaCuenta);
  /* La regla de la v930 dicha para la fecha: promover `cuando` a `fechaDoc`
     sería afirmar la procedencia de la procedencia. */
  T('su fecha NO se asciende a fecha de documento: se dice sin distinguir',
    !!(r.viejaFuente && r.viejaFuente.fechaDoc === null &&
       r.viejaFuente.sinDistinguir === '2026-09-10') &&
      /sin distinguir/i.test(r.viejaTexto || ''),
    r.viejaFuente ? JSON.stringify(r.viejaFuente) : '(ninguna)');

  console.log('\n  -- los índices escritos a mano NO se ascienden solos --');
  /* GUARDA DE MATERIAL, primero: sin los tres índices puestos por el camino
     de verdad no hay caso viejo que rechazar, y las tres de abajo pasarían
     por no tener nada delante. */
  T('MATERIAL · los tres índices quedaron escritos por sus casillas',
    r.indicesPuestos === 'ic,io,pisos', 'indicesPuestos=' + (r.indicesPuestos || '(ninguno)'));
  /* La condición que el usuario puso antes de esta tanda: un índice ya
     guardado en una ficha vieja NUNCA se promueve solo a confirmado. */
  T('una ficha vieja sin fuente anotada no puede ascender, y dice qué falta',
    !!(r.migSinFuente && r.migSinFuente.puede === false &&
       (r.migSinFuente.falta || []).join(' ').match(/quién|responde/i)),
    r.migSinFuente ? (r.migSinFuente.puede + ' · falta: ' + (r.migSinFuente.falta || []).join(', ')) : '(nada)');
  /* Y con lo MÁXIMO que una ficha vieja podía llevar —documento y año—
     tampoco: el esquema viejo no tiene dónde guardar quién responde, y
     derivarlo del nombre del documento sería inventar procedencia (v930). */
  T('ni con documento y año anotados, porque el QUIÉN no existía en ese esquema',
    !!(r.migConDocumento && r.migConDocumento.puede === false &&
       (r.migConDocumento.falta || []).join(' ').match(/quién|responde/i)),
    r.migConDocumento ? (r.migConDocumento.puede + ' · falta: ' + (r.migConDocumento.falta || []).join(', ')) : '(nada)');
  /* La otra mitad: una guarda sola falla abierto. Si alguien fuerza la
     entrada que la migración propone, el almacén la rechaza igual. */
  T('y forzarla por el almacén tampoco pasa',
    r.migForzada && r.migForzada.ok !== true,
    (r.migForzada && (r.migForzada.error || 'ok=' + r.migForzada.ok)) || '(nada)');

  console.log('\n  -- y la puerta se abre cuando una persona completa la procedencia --');
  /* Sin esta mitad, un «falta» puesto en todas partes pasaría en verde. */
  T('antes no hay botón, y el panel dice qué falta para que la norma cuente',
    r.botonAntes === false && /para que la norma cuente/i.test(r.avisoFalta || ''),
    (r.avisoFalta || '(sin aviso)').slice(0, 120));
  T('escrito quién responde, la puerta se abre',
    r.migCompleta && r.migCompleta.puede === true && r.botonDespues === true,
    'puede=' + (r.migCompleta && r.migCompleta.puede) + ' · botón=' + r.botonDespues);
  T('y la norma queda como dato de trámite, con su procedencia entera',
    r.normaGuardada === true && /Norma urbana/.test(r.normaTexto || '') &&
      /Curaduría Urbana Segunda/.test(r.normaTexto || '') && /del 2011/.test(r.normaTexto || ''),
    (r.normaTexto || '(ninguna)').slice(0, 150));
  /* La regla de la v930 en su sitio: el nombre del documento NO se usa como
     quién responde, ni siquiera cuando los dos están escritos. */
  T('el documento se guarda como documento y el quién como quién',
    !!(r.normaEntrada && r.normaEntrada.estado === 'confirmado' &&
       /Curaduría/.test(r.normaEntrada.quien || '') &&
       /Acuerdo 089/.test(r.normaEntrada.docto || '') &&
       r.normaEntrada.quien !== r.normaEntrada.docto),
    r.normaEntrada ? JSON.stringify(r.normaEntrada) : '(ninguna)');
  /* Los tres índices son el VALOR de un hueco y no tres huecos: un solo
     trámite trae los tres, y tres procedencias para un documento serían
     tres copias de la misma declaración. */
  T('los tres índices son el valor de UN hueco, no tres huecos',
    !!(r.normaEntrada && r.normaEntrada.valor &&
       ['io', 'ic', 'pisos'].every(k => r.normaEntrada.valor[k] !== undefined)) &&
      r.huecos.filter(h => /ocupacion|construccion|^altura$/.test(h)).length === 0,
    r.normaEntrada ? JSON.stringify(r.normaEntrada.valor) : '(ninguna)');

  console.log('\n  -- un post-sector cerrado por papel no se describe como uno de puntos --');
  /* Las dos ramas en la misma corrida: con edificios es «por puntos», sin
     ellos es «por papel». Medir solo una dejaría pasar la frase puesta en
     todas partes. */
  T('con edificios levantados, la procedencia se declara por puntos',
    !!(r.procedencia && r.procedencia.porPuntos === true),
    'porPuntos=' + (r.procedencia && r.procedencia.porPuntos));
  T('sin un solo punto, NO dice «lo levantado ya estaba publicado»',
    r.soloPapel && r.soloPapel.corrida === 'post' && r.soloPapel.porPuntos === false &&
      !/levantado en campo ya estaba/.test(r.soloPapel.texto || ''),
    'porPuntos=' + (r.soloPapel && r.soloPapel.porPuntos));
  T('y dice que lo que cerró el vacío es un documento',
    !!(r.soloPapel && /un documento y no puntos en el mapa/.test(r.soloPapel.texto || '')),
    (r.soloPapel && r.soloPapel.texto || '(sin panel)').slice(0, 150));

  T('la página no soltó errores', err.length === 0, err.join(' | ') || 'ninguno');

  console.log(mal ? '\n  ' + mal + ' comprobaciones fallaron\n' : '\n  todo en verde\n');
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
