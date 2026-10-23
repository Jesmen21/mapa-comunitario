const E = require('../entorno.js');
/* SEGURIDAD (js/83): lo que ya se reportó cerca, y los teléfonos.

   La pantalla LEE: los reportes de seguridad y los accidentes de tránsito
   vigentes a menos de 1 km del punto de referencia, con su antigüedad, y el
   123 y el 165 siempre a la vista. No escribe nada.

   Se mide sobre la aplicación entera, con un barrio de mentira servido por
   la hoja falsa, porque lo que importa es que lea EXACTAMENTE lo que muestra
   el mapa (`urbisDatosVisibles`) y nada más. El barrio trae a propósito lo
   que tiene que CALLAR —un hueco, un bicicletero de la misma dimensión que
   un robo, un robo a 3 km, un robo vencido, una etiqueta que el catálogo no
   tiene— y lo que tiene que contar, incluido un reporte SIN fecha, que es
   donde «hace un momento» sería mentira.

   Y las dos ramas de lo que falta: SIN MEDIR cuando no se leyó, cero cuando
   se leyó y no había nada (CLAUDE.md, «cero medido» y «cero mapeado»).    */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO;
const LEAFLET = S + 'node_modules/leaflet/dist/';
const REPO = process.env.REPO || E.RAIZ;
const C = { lat: 7.8939, lng: -72.5078 };
const AHORA = Date.now();
const escritas = [];

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true,
    permissions: ['geolocation'], geolocation: { latitude: C.lat - 0.02, longitude: C.lng, accuracy: 9 } });
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'vecina', rol: 'citizen',
        session_token: 't', active: true, verified: true }));
      localStorage.removeItem('urbis_db_cache_v1');
    } catch (e) {}
  });
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: fs.readFileSync(S + 'node_modules/chart.js/dist/chart.umd.js', 'utf8') }));
  await ctx.route(/basemaps\.cartocdn\.com|arcgisonline\.com|maptiles\.arcgis\.com|mt\d\.google\.com\/vt/,
    r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
  await ctx.route(/script\.google\.com/, r => {
    let p = {};
    try { p = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    /* Lo que escribe la capa de mapeos: toda acción db_* menos la lectura. */
    if (/^db_/.test(p.action || '') && p.action !== 'db_read') escritas.push(p.action);
    const data = (p.action === 'db_read' || !p.action) ? (globalThis.__DATOS || []) : [];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });

  const pg = await ctx.newPage();
  const errores = []; pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  /* El barrio. Metros al norte del centro → grados: 1° ≈ 111.320 m. */
  globalThis.__DATOS = await pg.evaluate((D) => {
    const base = (typeof BASE_OFFSET === 'number') ? BASE_OFFSET : 0;
    const off = base + TIMELINE_EXTRA_OFFSET;
    const fila = (tipo, item, metrosNorte, minAtras, extra) => {
      const d = [];
      for (let i = 0; i < off + 6; i++) d.push('');
      d[0] = item; d[1] = 'Barrio La Playa'; d[2] = ''; d[3] = '';
      d[base] = 'N/A'; d[base + 1] = 'Pendiente'; d[base + 2] = 'Vecina'; d[base + 3] = 'citizen'; d[base + 4] = '0';
      let fecha = '';
      if (minAtras != null) {
        fecha = new Date(D.AHORA - minAtras * 60000).toISOString();
        d[off] = fecha;
        d[off + 1] = new Date(D.AHORA - minAtras * 60000 + 8 * 3600000).toISOString();
        d[off + 2] = 'Temporal'; d[off + 3] = 'Activo';
      }
      Object.assign(d, extra || {});
      return { tipo, lat: String(D.C.lat + metrosNorte / 111320), lng: String(D.C.lng), descripcion: d.join(' | '), fecha };
    };
    const AL = '🚨 Alertas y Riesgos Urbanos', TR = '🚗 Reportes de Tráfico', SN = '🛡️ Seguridad Nacional y Conflicto';
    return [
      fila(AL, 'Robo', 200, 30),                          // cuenta · seguridad · hace 30 min
      fila(AL, 'Intento de robo', 400, null),             // cuenta · SIN fecha (ver abajo: la carga le pone una)
      fila(SN, 'Secuestro', 300, 60),                     // cuenta · conflicto
      fila(TR, 'Accidente de tránsito', 500, 125),        // cuenta · accidentes · hace 2 h 5 min
      fila(AL, 'Robo', 3000, 20),                         // fuera del radio
      fila(TR, 'Hueco en la vía', 100, 10),               // tráfico, no es accidente
      fila(AL, 'Bicicletero faltante o dañado', 100, 10), // misma dimensión, no es de seguridad
      fila(AL, 'Robo', 150, 600),                         // vencido: 10 h con vigencia de 8
      fila(AL, 'Atraco callejero', 120, 15)               // etiqueta que el catálogo no tiene
    ];
  }, { C, AHORA });

  await pg.evaluate(() => { try { localStorage.removeItem('urbis_db_cache_v1'); } catch (e) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);
  await pg.addStyleTag({ path: REPO + '/css/83-seguridad.css' });
  await pg.addScriptTag({ path: REPO + '/js/83-seguridad.js' });

  /* ── Antes de leer: SIN MEDIR, y los teléfonos igual ──────────────────── */
  const sinLeer = await pg.evaluate(() => {
    const SEG = window.URBIS_SEGURIDAD;
    SEG.configurar({ estadoLectura: () => null, cargados: () => false, cargar: () => null });
    SEG.abrir();
    const r = document.getElementById('urbis-seguridad');
    const o = { texto: r.textContent, tel123: !!r.querySelector('a[href="tel:123"]'), tel165: !!r.querySelector('a[href="tel:165"]'),
                ns: [...r.querySelectorAll('.urb-seg-n')].map(x => x.textContent) };
    SEG.configurar({ estadoLectura: () => ({ ok: false, desdeCache: false }), cargados: () => true });
    o.fallo = SEG.medir().sinMedir;
    SEG.cerrar();
    return o;
  });
  chk(sinLeer.tel123 && sinLeer.tel165, 'el 123 y el 165 están a la vista aunque no se haya leído nada');
  chk(sinLeer.ns.length === 3 && sinLeer.ns.every(n => n === 'SIN MEDIR') && /SIN MEDIR · los reportes todavía no se han leído/.test(sinLeer.texto),
      'sin leer, las tres cifras dicen SIN MEDIR y la causa, no 0 — ' + sinLeer.ns.join(' · '));
  chk(/no se pudieron leer/.test(sinLeer.fallo || ''), 'y una lectura fallida sin copia guardada es SIN MEDIR con su propia causa — ' + sinLeer.fallo);

  /* ── Con el barrio cargado, desde el centro del mapa ──────────────────── */
  const r = await pg.evaluate(async (D) => {
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    const SEG = window.URBIS_SEGURIDAD;
    SEG.configurar({ estadoLectura: () => window.urbisDBEstadoLectura || null, cargados: () => !!window.urbisPuntosCargados,
                     cargar: () => { try { return window.urbisCargarPuntos(); } catch (e) {} } });
    const ir = document.querySelector('[data-u52-go="map"]'); if (ir) ir.click();
    await esperar(900);
    window.map.setView([D.C.lat, D.C.lng], 16);
    await window.urbisCargarPuntos(); await esperar(400);
    const visibles = window.urbisDatosVisibles().map(p => String(p.descripcion).split(' | ')[0]);
    SEG.abrir(); await esperar(100);
    const raiz = document.getElementById('urbis-seguridad');
    const sec = id => { const s = raiz.querySelector('[data-seccion="' + id + '"]');
      return { n: s.querySelector('.urb-seg-n').textContent, items: [...s.querySelectorAll('li')].map(li => li.textContent) }; };
    return { visibles, texto: raiz.textContent, seg: sec('security'), con: sec('conflicto'), via: sec('vial'),
             tel123: !!raiz.querySelector('a[href="tel:123"]'), tel165: !!raiz.querySelector('a[href="tel:165"]') };
  }, { C });
  chk(r.visibles.length >= 8 && r.visibles.indexOf('Robo') !== -1,
      'MATERIAL · el mapa ve el barrio (' + r.visibles.length + ' reportes visibles: ' + r.visibles.join(', ') + ')');
  chk(r.visibles.filter(v => v === 'Robo').length === 2,
      'MATERIAL · y el robo vencido NO está entre los visibles: lo retira el mapa, no esta pantalla');
  chk(r.tel123 && r.tel165, 'con datos, el 123 y el 165 siguen ahí');
  chk(/centro del mapa/.test(r.texto) && /1 km a la redonda/.test(r.texto), 'dice desde dónde y en qué radio mide');
  chk(r.seg.n === '2' && r.seg.items.length === 2, 'seguridad: 2 (el robo a 200 m y el intento de robo) — ' + r.seg.n + ' · ' + r.seg.items.join(' | '));
  chk(r.con.n === '1' && /Secuestro/.test(r.con.items[0] || ''), 'seguridad nacional: 1, el secuestro — ' + r.con.n);
  chk(r.via.n === '1' && /Accidente de tránsito/.test(r.via.items[0] || ''), 'accidentes: 1 — y el hueco de la misma dimensión no entra — ' + r.via.n);
  chk(!/Bicicletero|Hueco|Atraco/.test(r.texto), 'no cuenta lo que no es de seguridad aunque comparta dimensión, ni etiquetas fuera del catálogo');
  chk(/Robo.*a 200 m · hace 30 min/.test(r.seg.items[0] || ''), 'el más cercano primero, con distancia y antigüedad — ' + r.seg.items[0]);
  /* Un reporte guardado SIN fecha no llega sin fecha a esta pantalla: al
     cargar, js/12 (cargarPuntos) le escribe en memoria la hora de la carga
     por medio de parseFechaReporte (js/05), que cae en «ahora». Es de
     Reportes y se reportó a la cabeza el 23 de octubre de 2026; acá se mide
     la regla PROPIA sobre una fila que no pasó por esa carga. */
  const sinFecha = await pg.evaluate(() => {
    const SEG = window.URBIS_SEGURIDAD, m = window.map.getCenter();
    const fila = { tipo: '🚨 Alertas y Riesgos Urbanos', lat: String(m.lat), lng: String(m.lng),
                   descripcion: 'Intento de robo | Barrio | | ', fecha: '' };
    SEG.configurar({ visibles: () => [fila] });
    SEG.abrir();
    const li = document.querySelector('#urbis-seguridad [data-seccion="security"] li');
    SEG.configurar({ visibles: () => window.urbisDatosVisibles() });
    return { creado: SEG.creadoMs(fila), texto: li ? li.textContent : '' };
  });
  chk(sinFecha.creado === null && /antigüedad SIN MEDIR · el reporte no trae fecha/.test(sinFecha.texto),
      'un reporte sin fecha dice SIN MEDIR, no «hace un momento» — ' + sinFecha.texto);
  chk(/hace 2 h 5 min/.test(r.via.items[0] || ''), 'las horas se cuentan bien — ' + r.via.items[0]);

  /* ── El catálogo manda: un tipo nuevo de Reportes entra solo ─────────── */
  const nuevo = await pg.evaluate(() => {
    const SEG = window.URBIS_SEGURIDAD;
    const antes = SEG.medir().secciones.find(s => s.id === 'security').n;
    const sec = window.URBIS_QUICK_REPORT_SECTIONS.find(s => s.id === 'security');
    sec.items.push(['street-mugging', '🚨', 'Atraco callejero', '🚨 Alertas y Riesgos Urbanos']);
    const despues = SEG.medir().secciones.find(s => s.id === 'security').n;
    sec.items.pop();
    return { antes, despues };
  });
  chk(nuevo.antes === 2 && nuevo.despues === 3,
      'un tipo que Reportes agregue a su pestaña entra sin tocar este módulo — ' + nuevo.antes + ' → ' + nuevo.despues);

  /* ── Cero medido: se leyó y no hay nada ───────────────────────────────── */
  const cero = await pg.evaluate(async () => {
    const SEG = window.URBIS_SEGURIDAD;
    window.map.setView([4.711, -74.072], 16);      // Bogotá: nada del barrio a menos de 1 km
    SEG.abrir();
    const raiz = document.getElementById('urbis-seguridad');
    return { ns: [...raiz.querySelectorAll('.urb-seg-n')].map(x => x.textContent), texto: raiz.textContent };
  });
  chk(cero.ns.join(',') === '0,0,0' && !/SIN MEDIR/.test(cero.texto) && (cero.texto.match(/Ninguno vigente/g) || []).length === 3,
      'leído y sin nada cerca, las tres dicen 0 y «ninguno vigente», no SIN MEDIR — ' + cero.ns.join(' · '));

  /* ── La ubicación: se pide al tocar, y no se escribe ──────────────────── */
  /* Las escrituras que la propia aplicación hace al cargar —archivar lo
     vencido, las notificaciones— no son de este módulo: se cuenta desde acá. */
  const escritasAntes = escritas.length;
  const gps = await pg.evaluate(async () => {
    window.URBIS_SEGURIDAD.abrir();
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    document.querySelector('#urbis-seguridad .urb-seg-gps').click();
    for (let i = 0; i < 30 && !/lugar donde está/.test(document.getElementById('urbis-seguridad').textContent); i++) await esperar(100);
    const raiz = document.getElementById('urbis-seguridad');
    return { texto: raiz.textContent, seg: raiz.querySelector('[data-seccion="security"] .urb-seg-n').textContent };
  });
  /* El GPS de la prueba está 2,2 km al sur del barrio, y todo el barrio queda al norte: nada a 1 km. */
  chk(/lugar donde está \(±9 m\)/.test(gps.texto) && gps.seg === '0',
      'al tocar «Usar mi ubicación» mide desde ahí, con su precisión — seguridad ' + gps.seg);
  chk(escritas.length === escritasAntes, 'abrir, medir y pedir la ubicación no escribe nada en la hoja — ' + (escritas.slice(escritasAntes).join(', ') || 'ninguna escritura'));
  const cerrada = await pg.evaluate(() => { document.querySelector('#urbis-seguridad .urb-seg-cerrar').click();
    return { hidden: document.getElementById('urbis-seguridad').hidden, abierta: window.URBIS_SEGURIDAD.abierta }; });
  chk(cerrada.hidden && !cerrada.abierta, 'cerrar la esconde');
  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
