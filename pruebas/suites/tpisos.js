const E = require('../entorno.js');
/* El edificio piso por piso.

   Llegó mapeando en la calle: «la mayoría de los usos son por edificios y
   dentro de ese edificio existen diferentes usos: primer piso tienda y
   segundo vivienda (mixto); cuatro pisos… así marcamos el piso y así
   calculamos alturas». Hasta acá un punto tenía UN número de pisos y una
   lista plana de usos; no decía en qué piso está cada uno, que es lo que
   distingue una casa con tienda de una torre de oficinas con local abajo.

   Se comprueba de punta a punta, en el orden en que pasa:

     · el vocabulario: cómo se escribe y se lee «1:Comercio;2-3:Vivienda», y
       qué es mixto y qué no;
     · el registro: la casilla nueva va AL FINAL y un punto viejo sin ella se
       lee igual que siempre;
     · el formulario ciudadano: al poner los pisos aparece una casilla por
       planta, y al cambiarlos se rearma sin perder lo elegido;
     · el análisis educativo: la altura se reparte entre lo que hay en cada
       planta, no en partes iguales;
     · Pro City, en la aplicación de verdad: se mapea una «Casa de dos
       pisos», se pone tienda abajo, se guarda, y el sector analizado lo
       cuenta en la ficha, en el pliego y en el informe.                      */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const guionDelMotor = require('../motor-navegador.js');
const REPO = E.RAIZ, S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.003;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];
const usos = []; let id = 1;
for (let i = 0; i < 40; i++) { const a = i * 9 * Math.PI / 180, d = (100 + (i % 5) * 50) / 111320;
  usos.push({ type: 'node', id: id++, lat: C.lat + Math.cos(a) * d, lon: C.lng + Math.sin(a) * d,
    tags: { name: 'U' + i, amenity: ['pharmacy', 'restaurant', 'school', 'bank'][i % 4] } }); }

const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });

  /* ══ 1 · El vocabulario, el registro, el formulario y el reparto ═════════
     Sin la aplicación entera: los mismos archivos que carga el mapa, sobre
     una página vacía, como en tnosabe. */
  const pg1 = await b.newPage();
  const errs1 = []; pg1.on('pageerror', e => errs1.push(e.message));
  await pg1.setContent('<div id="info-content"></div>');
  await pg1.evaluate(() => {
    window.URBIS_CONFIG = { TEMP_REPORT_TTL_HOURS: 8 };
    const chain = new Proxy(function () {}, {
      get: (t, k) => (k === Symbol.toPrimitive || k === 'then') ? undefined : chain,
      apply: () => chain, construct: () => chain });
    window.L = chain; window.map = chain;
  });
  await pg1.addScriptTag({ content: guionDelMotor() });
  for (const f of ['00-config', '00-app-shell', '01-audio-feedback', '02-auth-roles',
                   '03-map-data-config', '03b-edificio-vocabulario', '04-marker-proximity',
                   '05-helpers-temporal-security', '64-analisis-edu', '11-report-form']) {
    try { await pg1.addScriptTag({ path: REPO + '/js/' + f + '.js' }); } catch (e) {}
  }
  const r1 = await pg1.evaluate(() => {
    const E2 = window.URBIS_EDIFICIO, EDU = window.URBIS_EDU, SL = window.URBIS_SLOTS;
    const o = {};
    // El vocabulario.
    const tres = [{ piso: 1, uso: 'Comercio' }, { piso: 2, uso: 'Vivienda' }, { piso: 3, uso: 'Vivienda' }];
    o.codigo = E2.codificarPisos(tres);
    o.vuelta = E2.leerPisos(o.codigo);
    o.mezclaTres = E2.mezclaDe(tres);
    o.mezclaUna = E2.mezclaDe([{ piso: 1, uso: 'Vivienda' }, { piso: 2, uso: 'Vivienda' }]);
    o.mezclaNoSabe = E2.mezclaDe([{ piso: 1, uso: 'Comercio' }, { piso: 2, uso: E2.NO_SE_SABE }]);
    o.torre = E2.codificarPisos(Array.from({ length: 30 }, (_, i) => ({ piso: i + 1, uso: i ? 'Oficinas o servicios' : 'Comercio' })));
    o.basura = E2.leerPisos('1:Lo que sea;2:Vivienda;x:Comercio');
    /* Un piso con varios usos: «el piso 3 tiene gym, cafetería y oficina».
       Se escribe con «+» y vuelve entero. */
    const GYM = 'Deportivo o gimnasio', OFI = 'Oficinas o servicios';
    const conGym = [{ piso: 1, uso: 'Comercio' }, { piso: 2, uso: 'Comercio' },
                    { piso: 3, uso: GYM }, { piso: 3, uso: 'Comercio' }, { piso: 3, uso: OFI },
                    { piso: 4, uso: 'Vivienda' }, { piso: 5, uso: 'Vivienda' }];
    o.codigoVarios = E2.codificarPisos(conGym);
    o.vueltaVarios = E2.leerPisos(o.codigoVarios);
    o.mezclaVarios = E2.mezclaDe(conGym);
    // El tope: cuatro usos por planta, que es lo que se puede ver desde la acera.
    o.tope = E2.codificarPisos(['Vivienda', 'Comercio', OFI, GYM, 'Hospedaje']
      .map(u => ({ piso: 2, uso: u })));
    // Y «no se sabe» no convive con un uso real en la misma planta.
    o.noSabeFuera = E2.codificarPisos([{ piso: 1, uso: 'Comercio' }, { piso: 1, uso: E2.NO_SE_SABE }]);
    // Dos pisos seguidos se juntan en un tramo solo si tienen los mismos usos.
    o.tramoDistinto = E2.codificarPisos([{ piso: 1, uso: 'Comercio' }, { piso: 1, uso: OFI },
                                         { piso: 2, uso: 'Comercio' }]);
    o.pisosNombre = [E2.pisosDelNombre('Casa de dos pisos'), E2.pisosDelNombre('Torre residencial (4–10 pisos)'), E2.pisosDelNombre('Bar')];
    o.defectoMixto = [E2.usoPisoPorDefecto('Mixto (Residencial-Comercial)', 1), E2.usoPisoPorDefecto('Mixto (Residencial-Comercial)', 2)];
    o.esEdificio = [E2.esUsoDeEdificio('Residencial'), E2.esUsoDeEdificio('Esp. Público'), E2.esUsoDeEdificio('Vías e Infraestructura Vial')];

    // El registro: la casilla al final, y un punto viejo que no la trae.
    const usosMat = E2.todosLosUsos().map(() => 'NO');
    const base = ['Residencial · Casa de dos pisos', 'C', 'n', 'Bueno', 'Activo', 'N/A'].concat(usosMat)
      .concat(['N/A', 'Aprobado', 'A', 'edu', '0', 'a@b.c', '1', 'C'])
      .concat(['2026-09-01T10:00:00Z', 'N/A', 'Permanente', 'Activo', 'General']);
    const conFicha = (pisos, porPiso) => {
      const d = base.concat([E2.SIN_REGISTRAR, pisos, '', '', '']);
      while (d.length < SL.edificioUsosPorPiso) d.push('');
      d[SL.edificioUsosPorPiso] = porPiso;
      return d.join(' | ');
    };
    o.slotAlFinal = SL.edificioUsosPorPiso > SL.victimas && SL.edificioUsosPorPiso > SL.edificioOtroTexto;
    const fNuevo = E2.leer(conFicha('3', '1:Comercio;2-3:Vivienda'));
    o.nuevo = { pisos: fNuevo.pisos, reg: fNuevo.pisosRegistrados, n: fNuevo.usosPorPiso.length, mixto: fNuevo.mezcla.mixto, resumen: fNuevo.mezcla.resumen };
    const fSinPisos = E2.leer(conFicha('', '1:Comercio;2:Vivienda'));
    o.sinNumero = { pisos: fSinPisos.pisos, reg: fSinPisos.pisosRegistrados };
    const fViejo = E2.leer(base.concat([E2.SIN_REGISTRAR, '2', '', '', '']).join(' | '));
    o.viejo = { pisos: fViejo.pisos, n: fViejo.usosPorPiso.length, mixto: fViejo.mezcla.mixto };

    // El formulario ciudadano.
    window.userRole = 'edu';
    window.formPaso2('Vivienda y Residencial', 7.9, -72.4, '');
    const cont = document.getElementById('info-content');
    const nSel = () => cont.querySelectorAll('select.ins-uso-piso').length;
    o.formSinPisos = nSel();
    const ip = cont.querySelector('#ins-pisos');
    ip.value = '3'; ip.dispatchEvent(new Event('input', { bubbles: true }));
    o.formTres = nSel();
    o.formOrden = [...cont.querySelectorAll('select.ins-uso-piso')].map(s => s.getAttribute('data-piso')).join(',');
    o.formDefecto = [...cont.querySelectorAll('select.ins-uso-piso')].map(s => s.value).join('|');
    const s1 = cont.querySelector('select.ins-uso-piso[data-piso="1"]');
    s1.value = 'Comercio'; s1.dispatchEvent(new Event('change', { bubbles: true }));
    o.formResumen = (cont.querySelector('#ins-pisos-resumen') || {}).textContent || '';
    ip.value = '4'; ip.dispatchEvent(new Event('input', { bubbles: true }));
    o.formCuatro = nSel();
    o.formConserva = (cont.querySelector('select.ins-uso-piso[data-piso="1"]') || {}).value;
    o.formLeido = E2.codificarPisos(E2.leerUsosPorPisoDelFormulario(cont));
    o.formRotuloCalle = /Piso 1 \(calle\)/.test(cont.innerHTML);

    // El análisis educativo reparte la altura por planta.
    const p = { lat: '7.9', lng: '-72.4', tipo: 'Vivienda y Residencial', descripcion: conFicha('3', '1:Comercio;2-3:Vivienda') };
    const els = EDU.puntoAElemento(p, 0) || [];
    o.elementos = els.map(e => ({ sub: e.tags['urbis:sub'], int: e.tags['urbis:intensidad'], mixto: e.tags['urbis:mixto'], niveles: e.tags['building:levels'] }));

    /* Y una planta partida entre tres usos vale UNA, no tres: el edificio de
       cinco pisos tiene que seguir sumando cinco, se reparta como se reparta.
       Contar tres lo haría pesar más que la torre de al lado. */
    const p2 = { lat: '7.9', lng: '-72.4', tipo: 'Vivienda y Residencial',
      descripcion: conFicha('5', '1-2:Comercio;3:' + GYM + '+Comercio+' + OFI + ';4-5:Vivienda') };
    const els2 = EDU.puntoAElemento(p2, 1) || [];
    o.reparto = els2.map(e => ({ sub: e.tags['urbis:sub'], int: Number(e.tags['urbis:intensidad']) }))
      .sort((a, b) => a.sub < b.sub ? -1 : 1);
    o.repartoSuma = Math.round(o.reparto.reduce((n, x) => n + x.int, 0) * 100) / 100;
    return o;
  });
  await pg1.close();

  console.log('\n  -- el vocabulario: cómo se escribe y qué es mixto --');
  T('se escribe con tramos y se lee igual', r1.codigo === '1:Comercio;2-3:Vivienda' &&
    JSON.stringify(r1.vuelta) === JSON.stringify([{ piso: 1, uso: 'Comercio' }, { piso: 2, uso: 'Vivienda' }, { piso: 3, uso: 'Vivienda' }]),
    r1.codigo);
  T('tienda abajo y vivienda arriba es mixto, y lo dice así',
    r1.mezclaTres.mixto && r1.mezclaTres.resumen === 'Comercio abajo, vivienda arriba', r1.mezclaTres.resumen);
  T('todo vivienda no es mixto', !r1.mezclaUna.mixto && r1.mezclaUna.resumen === 'Todo vivienda', r1.mezclaUna.resumen);
  T('y «no se sabe» no mezcla nada', !r1.mezclaNoSabe.mixto, r1.mezclaNoSabe.resumen);
  T('una torre de treinta pisos cabe en dos tramos', r1.torre === '1:Comercio;2-30:Oficinas o servicios', r1.torre);
  T('lo que no está en la lista no entra', r1.basura.length === 1 && r1.basura[0].uso === 'Vivienda', JSON.stringify(r1.basura));
  T('el nombre del tipo ya dice los pisos', JSON.stringify(r1.pisosNombre) === '[2,4,0]', r1.pisosNombre.join(','));

  console.log('\n  -- y un piso puede tener varios usos --');
  /* Se pidió con el ejemplo en la mano: «el piso 3 tiene gym, cafetería y
     oficina». Un edificio real no reparte un uso por planta. */
  T('se escriben con «+» dentro de su piso',
    r1.codigoVarios === '1-2:Comercio;3:Deportivo o gimnasio+Comercio+Oficinas o servicios;4-5:Vivienda',
    r1.codigoVarios);
  T('y vuelven los tres, en su piso', (r1.vueltaVarios || []).filter(x => x.piso === 3).length === 3 &&
    JSON.stringify(r1.vueltaVarios.map(x => x.uso)) ===
    JSON.stringify(['Comercio', 'Comercio', 'Deportivo o gimnasio', 'Comercio', 'Oficinas o servicios', 'Vivienda', 'Vivienda']),
    (r1.vueltaVarios || []).filter(x => x.piso === 3).map(x => x.uso).join(' + '));
  T('el edificio se lee como mixto y dice qué piso los junta',
    r1.mezclaVarios.mixto && JSON.stringify(r1.mezclaVarios.variosPorPiso) === '[3]' &&
    /el piso 3 junta tres usos/.test(r1.mezclaVarios.resumen), r1.mezclaVarios.resumen);
  T('con cuatro usos o más no lista todo: dice cuántos y en cuántos pisos',
    /^Mixto: 4 usos en 5 pisos/.test(r1.mezclaVarios.resumen), r1.mezclaVarios.resumen);
  T('cuatro usos por planta es el tope', (r1.tope.split(':')[1] || '').split('+').length === 4, r1.tope);
  T('«no se sabe» no convive con un uso observado en la misma planta',
    r1.noSabeFuera === '1:Comercio', r1.noSabeFuera);
  T('dos pisos se juntan en un tramo solo si tienen los MISMOS usos',
    r1.tramoDistinto === '1:Comercio+Oficinas o servicios;2:Comercio', r1.tramoDistinto);
  T('un mixto declarado se prellena con el local abajo', r1.defectoMixto[0] === 'Comercio' && r1.defectoMixto[1] === 'Vivienda');
  T('un parque o una vía no tienen pisos', r1.esEdificio[0] === true && !r1.esEdificio[1] && !r1.esEdificio[2]);

  console.log('\n  -- el registro: la casilla al final --');
  T('la casilla nueva va después de todas las que existían', r1.slotAlFinal);
  T('un punto nuevo se lee con sus plantas', r1.nuevo.pisos === 3 && r1.nuevo.n === 3 && r1.nuevo.mixto,
    r1.nuevo.pisos + ' pisos · ' + r1.nuevo.n + ' plantas · ' + r1.nuevo.resumen);
  T('sin el número de pisos, las plantas lo dicen', r1.sinNumero.pisos === 2 && r1.sinNumero.reg,
    r1.sinNumero.pisos + ' pisos');
  T('y un punto viejo sin la casilla se lee como siempre', r1.viejo.pisos === 2 && r1.viejo.n === 0 && !r1.viejo.mixto);

  console.log('\n  -- el formulario ciudadano: una casilla por planta --');
  T('sin pisos no hay plantas', r1.formSinPisos === 0);
  T('con tres pisos, tres plantas, del último al primero', r1.formTres === 3 && r1.formOrden === '3,2,1', r1.formOrden);
  T('prellenadas con el uso de la categoría', r1.formDefecto === 'Vivienda|Vivienda|Vivienda', r1.formDefecto);
  T('la calle se llama por su nombre', r1.formRotuloCalle);
  T('al poner tienda abajo, lo dice', /Edificio mixto · Comercio abajo, vivienda arriba/.test(r1.formResumen), r1.formResumen);
  T('al subir a cuatro pisos se rearma sin perder lo elegido',
    r1.formCuatro === 4 && r1.formConserva === 'Comercio' && r1.formLeido === '1:Comercio;2-4:Vivienda', r1.formLeido);

  console.log('\n  -- el análisis reparte la altura por planta --');
  const porSub = {}; (r1.elementos || []).forEach(e => { porSub[e.sub] = e; });
  T('un comercio de intensidad 1 y una vivienda de intensidad 2, no un mixto de tres',
    (r1.elementos || []).length === 2 && porSub.comercio_otro && porSub.comercio_otro.int === '1' &&
    porSub.residencial && porSub.residencial.int === '2',
    JSON.stringify(r1.elementos));
  T('marcado como mixto y con sus tres niveles',
    (r1.elementos || []).every(e => e.mixto === 'si' && e.niveles === '3'));
  /* Cinco pisos: dos de comercio, uno partido entre tres usos y dos de
     vivienda. El piso partido da un tercio a cada uno, así que el comercio
     suma 2,33 y el edificio entero sigue sumando cinco. El total llega a
     4,99 y no a 5 porque cada peso se redondea a dos decimales al escribirlo
     —un tercio no se escribe exacto—: se admite ese centavo y no más, que es
     la diferencia entre redondear y contar mal. */
  const rep = {}; (r1.reparto || []).forEach(x => { rep[x.sub] = x.int; });
  T('una planta partida entre tres usos vale una, no tres',
    Math.abs(r1.repartoSuma - 5) <= 0.02 && rep.comercio_otro === 2.33 &&
    rep.deportivo === 0.33 && rep.oficina === 0.33 && rep.residencial === 2,
    (r1.reparto || []).map(x => x.sub + ' ' + x.int).join(' · ') + ' = ' + r1.repartoSuma);
  T('sin errores de página en esa parte', errs1.length === 0, errs1[0] || 'ninguno');

  /* ══ 2 · Pro City, en la aplicación de verdad ════════════════════════════ */
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
    if (/overpass/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ elements: usos }) });
    if (/locationiq/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ address: { city: 'Cúcuta', state: 'Norte de Santander' } }) });
    if (/ags\.esri\.co/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ features: [{ attributes: { TOTAL: 3045, N: 42 } }] }) });
    /* La hoja de cálculo, de mentira pero con memoria: lo que la aplicación
       escribe se le devuelve cuando vuelve a leer. Es lo que hace que el punto
       recién publicado siga en el mapa después del refresco de dos segundos,
       que es como pasa de verdad. */
    if (/script\.google\.com/.test(u)) {
      let pedido = {};
      try { pedido = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      if (pedido.action === 'db_write' && pedido.fila) { filas.push(pedido.fila); }
      if (pedido.action === 'db_update' && pedido.set) {
        filas.forEach(fl => { if (String(fl[pedido.col]) === String(pedido.value)) Object.assign(fl, pedido.set); });
      }
      const cuerpo = pedido.action === 'db_read' ? { ok: true, data: filas } : { ok: true, data: [] };
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });
    }
    if (/cdn\.jsdelivr\.net/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    r.abort();
  });
  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 120)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r2 = await pg.evaluate(async (D) => {
    const { C, POL } = D, o = {}, esperar = ms => new Promise(r => setTimeout(r, ms));
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    window.map.setView([C.lat, C.lng], 17); await esperar(400);
    const q = s => document.querySelector(s);
    const clic = async (s, ms) => { const b2 = q(s); if (b2) b2.click(); await esperar(ms || 400); return !!b2; };

    // Mapear aquí: en el mapa, con el dedo.
    await clic('[data-u52-call="procity-open-map"]', 600);
    o.manual = await clic('[data-u52-call="procity-loc-manual"]', 400);
    window.map.fire('click', { latlng: { lat: C.lat, lng: C.lng } }); await esperar(700);
    o.grupo = await clic('[data-u52-procity-group-entry="vivienda"]', 600);
    o.uso = await clic('[data-u52-procity-use="Residencial"]', 600);
    o.tipo = await clic('[data-u52-procity-item="Residencial · Casa de dos pisos"]', 700);

    const panel = q('#u52-quick-report-panel');
    const ip = panel && panel.querySelector('#ins-pisos');
    o.hayPisos = !!ip;
    o.pisosPre = ip ? ip.value : '';
    const sel = () => panel ? [...panel.querySelectorAll('select.ins-uso-piso')] : [];
    o.plantas = sel().length;
    o.defecto = sel().map(s => s.value).join('|');
    /* ── Cómo se ve en el teléfono ─────────────────────────────────────
       Esta prueba corre a 412 px, que es el ancho del celular donde se
       mapea, así que puede medirlo de verdad. Dos cosas se rompieron acá y
       solo se vieron mirando la captura: los desplegables salían tinta sobre
       tinta —los estilos de formulario de la aplicación pintan todo campo de
       oscuro y llevan !important— y una torre de doce pisos estiraba el
       panel hasta empujar el botón de guardar bien lejos. */
    const contrasteDe = (el) => {
      const cs = getComputedStyle(el);
      const lum = (c) => {
        const m = String(c).match(/\d+(\.\d+)?/g) || [255, 255, 255];
        const v = m.slice(0, 3).map(x => { const n = Number(x) / 255;
          return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); });
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
      };
      const a = lum(cs.backgroundColor), b = lum(cs.webkitTextFillColor || cs.color);
      return Math.round(100 * (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) / 100;
    };
    const selPiso = panel && panel.querySelector('select.ins-uso-piso');
    o.contraste = selPiso ? contrasteDe(selPiso) : 0;
    o.altoFila = (function () { const fl = selPiso && selPiso.closest('.edif-piso');
      return fl ? Math.round(fl.getBoundingClientRect().height) : 0; })();
    if (ip) { ip.value = '12'; ip.dispatchEvent(new Event('input', { bubbles: true })); await esperar(250); }
    o.torre = (function () {
      const lista = panel && panel.querySelector('.edif-pisos');
      if (!lista) return null;
      return { filas: panel.querySelectorAll('select.ins-uso-piso').length,
        alto: Math.round(lista.getBoundingClientRect().height), contenido: lista.scrollHeight,
        panel: panel.scrollHeight, ventana: window.innerHeight };
    })();
    if (ip) { ip.value = '2'; ip.dispatchEvent(new Event('input', { bubbles: true })); await esperar(250); }
    o.vuelveADos = panel ? panel.querySelectorAll('select.ins-uso-piso').length : 0;

    /* ── Varios usos en una misma planta, con el dedo ──────────────────
       «El piso 3 tiene gym, cafetería y oficina». Acá el edificio tiene dos
       pisos, así que se prueba en el segundo: se toca «+ uso», se elige otro,
       y se comprueba que el código los junta con «+». Después se quita con
       la «×» y todo vuelve como estaba, que es lo que el resto de la prueba
       espera encontrar. */
    const E3 = window.URBIS_EDIFICIO;
    const codigoAhora = () => E3.codificarPisos(E3.leerUsosPorPisoDelFormulario(panel));
    o.codigoAntesDeSumar = codigoAhora();
    const bMas = panel && panel.querySelector('[data-mas="2"]');
    o.hayMas = !!bMas;
    if (bMas) { bMas.click(); await esperar(250); }
    o.selectsPiso2 = panel ? panel.querySelectorAll('select.ins-uso-piso[data-piso="2"]').length : 0;
    const nuevo2 = panel && panel.querySelectorAll('select.ins-uso-piso[data-piso="2"]')[1];
    if (nuevo2) { nuevo2.value = 'Deportivo o gimnasio'; nuevo2.dispatchEvent(new Event('change', { bubbles: true })); await esperar(200); }
    o.codigoConDos = codigoAhora();
    o.resumenConDos = ((panel && panel.querySelector('#ins-pisos-resumen')) || {}).textContent || '';
    const bQuita = panel && panel.querySelector('[data-quita-piso="2"]');
    o.hayQuita = !!bQuita;
    if (bQuita) { bQuita.click(); await esperar(250); }
    o.codigoTrasQuitar = codigoAhora();

    const s1 = panel && panel.querySelector('select.ins-uso-piso[data-piso="1"]');
    if (s1) { s1.value = 'Comercio'; s1.dispatchEvent(new Event('change', { bubbles: true })); await esperar(150); }
    o.resumen = ((panel && panel.querySelector('#ins-pisos-resumen')) || {}).textContent || '';
    const dir = panel && panel.querySelector('#ins-direccion');
    if (dir) dir.value = 'Calle 8 con avenida 3';

    // Se publica de verdad: va a la hoja de cálculo (de mentira, con
    // memoria) y a los dos segundos el mapa se refresca desde ella.
    await clic('[data-u52-call="procity-publish"]', 3500);
    const guardado = ((typeof window.urbisDatosVisibles === 'function' ? window.urbisDatosVisibles() : []) || [])
      .filter(x => /Matriz de Usos/.test(String(x.tipo || '')))[0] || null;
    o.guardo = !!guardado;
    if (guardado) {
      const d = String(guardado.descripcion || '').split(' | ');
      const SL = window.URBIS_SLOTS;
      o.slotPisos = d[SL.edificioPisos];
      o.slotPlantas = d[SL.edificioUsosPorPiso];
      o.tipoGuardado = guardado.tipo;
      const f = window.URBIS_EDIFICIO.leer(guardado.descripcion);
      o.leidoMixto = f.mezcla.mixto; o.leidoResumen = f.mezcla.resumen;
    }

    /* ── Editar lo mapeado ─────────────────────────────────────────────
       Se toca el punto en el mapa, se abre su ficha y se edita. Tiene que
       volver TODO lo guardado: los pisos y el uso de cada planta. Un
       formulario de edición que vuelve en blanco no es editar, es volver a
       mapear encima. */
    const marcadorDe = (lat) => {
      let hallado = null;
      try {
        window.map.eachLayer(l => {
          if (hallado || !l || !l.getLatLng || !l.fire) return;
          if (Math.abs(l.getLatLng().lat - lat) < 1e-6) hallado = l;
        });
      } catch (e) {}
      return hallado;
    };
    const m1 = marcadorDe(C.lat);
    o.hayMarcador = !!m1;
    if (m1) { m1.fire('click', { latlng: { lat: C.lat, lng: C.lng } }); await esperar(600); }
    o.hayFichaPunto = !!q('[data-u52-call="procity-sel-edit"]');
    await clic('[data-u52-call="procity-sel-edit"]', 900);
    const panelEd = q('#u52-quick-report-panel');
    const ipEd = panelEd && panelEd.querySelector('#ins-pisos');
    o.edPisos = ipEd ? ipEd.value : '';
    o.edPlantas = panelEd ? [...panelEd.querySelectorAll('select.ins-uso-piso')].map(x => x.value).join('|') : '';
    o.edEsEdicion = /Actualizar en Pro City/.test((panelEd && panelEd.textContent) || '');

    /* Y editar no puede BORRAR lo que esta pantalla no pregunta. El punto de
       abajo trae materialidad y época levantadas con el formulario
       ciudadano; se abre en Pro City —que solo pregunta pisos y plantas— se
       cambia la altura y se guarda. Las dos tienen que seguir ahí: perder un
       dato de campo por abrir otra pantalla es la peor clase de pérdida,
       porque nadie se entera. */
    const EDIF2 = window.URBIS_EDIFICIO, SL2 = window.URBIS_SLOTS;
    const MATERIAL = 'Concreto reforzado (pórticos o muros)', EPOCA = '2010 o posterior (NSR-10)';
    const latOtro = C.lat + 0.0004;
    const dOtro = String(((typeof globalData !== 'undefined' && globalData) || [])
      .filter(x => Math.abs(parseFloat(x.lat) - C.lat) < 1e-6)[0].descripcion).split(' | ');
    dOtro[0] = 'Residencial · Casa de tres o más pisos';
    dOtro[SL2.edificioMaterialidad] = MATERIAL;
    dOtro[SL2.edificioEpoca] = EPOCA;
    dOtro[SL2.edificioPisos] = '3';
    dOtro[SL2.edificioUsosPorPiso] = '';
    await window.urbisGuardarFila({ tipo: '🗺️ Matriz de Usos', lat: String(latOtro), lng: String(C.lng),
      descripcion: dOtro.join(' | '), fecha: new Date().toISOString() });
    if (typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos();
    await esperar(1800);
    const m2 = marcadorDe(latOtro);
    o.hayOtro = !!m2;
    if (m2) { m2.fire('click', { latlng: { lat: latOtro, lng: C.lng } }); await esperar(600); }
    await clic('[data-u52-call="procity-sel-edit"]', 900);
    const panelEd2 = q('#u52-quick-report-panel');
    const ip2 = panelEd2 && panelEd2.querySelector('#ins-pisos');
    o.otroPisos = ip2 ? ip2.value : '';
    const s2 = panelEd2 && panelEd2.querySelector('select.ins-uso-piso[data-piso="1"]');
    if (s2) { s2.value = 'Comercio'; s2.dispatchEvent(new Event('change', { bubbles: true })); await esperar(150); }
    const dir2 = panelEd2 && panelEd2.querySelector('#ins-direccion');
    if (dir2) dir2.value = 'Calle 8 con avenida 3';
    await clic('[data-u52-call="procity-publish"]', 2500);
    const tras = ((typeof window.urbisDatosVisibles === 'function' ? window.urbisDatosVisibles() : []) || [])
      .filter(x => Math.abs(parseFloat(x.lat) - latOtro) < 1e-6)[0];
    o.trasEditar = tras ? (function () {
      const fi = EDIF2.leer(tras.descripcion);
      const dd = String(tras.descripcion).split(' | ');
      return { material: dd[SL2.edificioMaterialidad], epoca: dd[SL2.edificioEpoca],
        pisos: fi.pisos, plantas: EDIF2.codificarPisos(fi.usosPorPiso) };
    })() : null;

    /* Y el sector analizado lo cuenta. Se espera a que el mapa termine de
       refrescarse: publicar dispara una recarga de los puntos a los dos
       segundos, y sin esperarla la ficha contaba un edificio y el pliego
       —armado después— contaba dos. La prueba medía la carrera, no el
       resultado. */
    for (let i = 0; i < 40; i++) {
      const n = ((typeof window.urbisDatosVisibles === 'function' ? window.urbisDatosVisibles() : []) || [])
        .filter(x => /Matriz de Usos/.test(String(x.tipo || ''))).length;
      if (n >= 2) break;
      await esperar(300);
    }
    const A = window.URBIS_PC_ANALISIS, R = window.URBIS_PC_RECON;
    A.iniciarDibujo(); POL.forEach(p => A.agregarPunto(p.lat, p.lng)); A.agregarPunto(POL[0].lat, POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1500);
    o.campo = R.alturasDeCampo ? R.alturasDeCampo() : null;
    const H = document.getElementById('pcr-hoja');
    const ag = H && H.querySelector('[data-pcr="agrandar"]'); if (ag) { ag.click(); await esperar(400); }
    o.ficha = R.htmlDeLaFicha ? R.htmlDeLaFicha() : (H ? H.innerHTML : '');

    let capturado = '';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function (h) { capturado = h; };
    const bl = H && H.querySelector('[data-pcr="lamina-ver"]');
    if (bl) { bl.click(); await esperar(900); }
    o.lamina = capturado; capturado = '';
    const ag2 = H && H.querySelector('[data-pcr="agrandar"]'); if (ag2 && H.classList.contains('pcr-encogida')) { ag2.click(); await esperar(300); }
    const bi = H && H.querySelector('[data-pcr="imprimir"]');
    if (bi) { bi.click(); await esperar(900); }
    o.informe = capturado;
    return o;
  }, { C, POL });
  await pg.close(); await b.close();

  console.log('\n  -- Pro City: mapear una casa de dos pisos con tienda abajo --');
  T('se llega a la ficha del tipo', r2.manual && r2.grupo && r2.uso && r2.tipo);
  T('pregunta los pisos, prellenados desde el nombre del tipo', r2.hayPisos && r2.pisosPre === '2', r2.pisosPre + ' pisos');
  T('una planta por piso, prellenada con vivienda', r2.plantas === 2 && r2.defecto === 'Vivienda|Vivienda', r2.defecto);
  T('los desplegables se leen: no son tinta sobre tinta', r2.contraste >= 4.5,
    'contraste ' + r2.contraste + ':1');
  T('y cada planta ocupa un renglón, no un bloque', r2.altoFila > 0 && r2.altoFila <= 56,
    r2.altoFila + ' px de alto');
  /* Una torre de doce pisos: la lista se recorre por dentro en vez de
     estirar el panel hasta que el botón de guardar quede a media pantalla de
     distancia. */
  const tr = r2.torre;
  T('una torre de doce pisos no estira el panel: la lista se recorre por dentro',
    !!tr && tr.filas === 12 && tr.alto < tr.contenido && tr.alto <= tr.ventana * 0.45,
    tr ? tr.filas + ' plantas · lista ' + tr.alto + ' de ' + tr.contenido + ' px · panel ' + tr.panel : 'no hay lista');
  T('y al volver a dos pisos vuelven dos plantas', r2.vuelveADos === 2, r2.vuelveADos + ' plantas');
  T('cada planta trae su «+ uso» para sumar otro', r2.hayMas && r2.selectsPiso2 === 2,
    r2.selectsPiso2 + ' desplegables en el piso 2');
  T('y los dos usos quedan juntos en su piso',
    r2.codigoAntesDeSumar === '1-2:Vivienda' && r2.codigoConDos === '1:Vivienda;2:Vivienda+Deportivo o gimnasio',
    r2.codigoConDos);
  T('la lectura del edificio lo dice al momento', /el piso 2 junta dos usos/.test(r2.resumenConDos), r2.resumenConDos);
  T('y con la «×» se quita el que sobra', r2.hayQuita && r2.codigoTrasQuitar === '1-2:Vivienda', r2.codigoTrasQuitar);
  T('con tienda abajo, lo dice antes de guardar', /Edificio mixto · Comercio abajo, vivienda arriba/.test(r2.resumen), r2.resumen);
  T('se guarda en su casilla del registro', r2.guardo && r2.slotPisos === '2' && r2.slotPlantas === '1:Comercio;2:Vivienda',
    'pisos «' + r2.slotPisos + '» · plantas «' + r2.slotPlantas + '»');
  T('y al leerlo vuelve como mixto', r2.leidoMixto === true && r2.leidoResumen === 'Comercio abajo, vivienda arriba', r2.leidoResumen);

  console.log('\n  -- editar lo mapeado --');
  T('el punto se puede tocar en el mapa y abre su ficha', r2.hayMarcador && r2.hayFichaPunto);
  T('al editarlo vuelven los pisos y el uso de cada planta',
    r2.edEsEdicion && r2.edPisos === '2' && r2.edPlantas === 'Vivienda|Comercio',
    r2.edPisos + ' pisos · plantas ' + (r2.edPlantas || '(vacías)'));
  const te = r2.trasEditar;
  T('y editar en Pro City no borra la materialidad ni la época del punto',
    !!te && /Concreto reforzado/.test(te.material || '') && /NSR-10/.test(te.epoca || ''),
    te ? 'material «' + te.material + '» · época «' + te.epoca + '»' : 'no se pudo editar');
  T('mientras lo que sí pregunta queda guardado',
    !!te && te.pisos === 3 && te.plantas === '1:Comercio;2-3:Vivienda',
    te ? te.pisos + ' pisos · ' + te.plantas : 'nada');

  console.log('\n  -- y el sector analizado lo cuenta --');
  const c = r2.campo;
  T('el análisis encuentra los edificios contados en campo',
    !!c && c.edificios === 2 && c.conPisos === 2 && c.maximo === 3,
    c ? c.conPisos + ' con pisos de ' + c.edificios + ' · máximo ' + c.maximo : 'nada');
  T('los dos como mixtos, con su combinación',
    !!c && c.mixtos === 2 && c.combinaciones[0].resumen === 'Comercio abajo, vivienda arriba' && c.combinaciones[0].n === 2,
    c ? JSON.stringify(c.combinaciones) : 'nada');
  /* Y el mapa: lo contado en campo va en rombo sobre el plano, con el tono
     de sus pisos. Sin esto, un curso que contó cuarenta edificios veía el
     mapa de alturas igual que antes de salir a la calle. */
  const mapaAlt = ((r2.lamina || '').split('<section class="caja')
    .filter(x => /^ mapa-caja/.test(x) && /<h2>Alturas de lo construido( · el mapa)?<\/h2>/.test(x))[0]) || '';
  const rombos = (mapaAlt.match(/<path d="M[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+Z" fill="#(5BB4E5|0A6F9E)"/g) || []).length;
  T('el mapa de alturas los dibuja, con el tono de sus pisos', rombos === 2, rombos + ' rombos');
  T('y lo dice en sus convenciones y en el pie',
    /Contado en campo \(rombo\)/.test(mapaAlt) && /2 contados en campo, piso por piso/.test(mapaAlt),
    (mapaAlt.match(/\d+ contados en campo[^<]*/) || ['no lo dice'])[0]);
  T('la ficha en pantalla lo muestra', /Contado en campo, piso por piso/.test(r2.ficha || '') && /Levantado en campo/.test(r2.ficha || ''));
  const cajaAlt = ((r2.lamina || '').split('<section class="caja').filter(x => /<h2>Alturas de lo construido<\/h2>/.test(x))[0]) || '';
  /* Los dos edificios del sector —el mapeado y el editado— llevan tienda
     abajo, así que los dos son mixtos y la frase lo dice con su combinación. */
  T('el pliego trae la caja de alturas con lo contado en campo',
    /class="lee campo">Levantado en campo/.test(cajaAlt) &&
    /<b>2<\/b> edificios con los pisos contados/.test(cajaAlt) &&
    /<b>2<\/b> de uso mixto: comercio abajo, vivienda arriba/.test(cajaAlt),
    cajaAlt ? (cajaAlt.match(/Levantado en campo[\s\S]*?<\/p>/) || ['sin frase'])[0].replace(/<[^>]+>/g, '') : 'sin caja');
  T('y el informe en hojas también', /<h3>Contado en campo, piso por piso<\/h3>/.test(r2.informe || '') && /Qué hay en las plantas/.test(r2.informe || ''));

  /* Y llega a la síntesis, que es donde se leen las conclusiones. Lo mixto
     contado en campo no sale de ningún dato abierto: es lo que el curso
     agregó al sector, y por eso vale como fortaleza. */
  console.log('\n  -- y llega a la síntesis del sector --');
  const cuad = (c) => ((r2.lamina || '').match(new RegExp('<div class="sn ' + c + '">[\\s\\S]*?<\\/div><\\/div>')) || [''])[0];
  T('la mezcla de usos por planta entra como fortaleza',
    /mezclan usos por planta/.test(cuad('ok')),
    (cuad('ok').match(/<span>[^<]*mezclan usos por planta[^<]*/) || ['no está'])[0].replace('<span>', ''));
  T('con el número que la sostiene', /2 de 2 edificios/.test(cuad('ok')),
    (cuad('ok').match(/\d+ de \d+ edificios/) || ['sin número'])[0]);

  console.log('');
  T('sin errores de JavaScript', err.filter(e => !/L is not defined|Unexpected end/.test(e)).length === 0, err.slice(0, 2).join(' / ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
