const E = require('../entorno.js');
/* El pliego, en PDF y del tamaño que es.

   Llegó con la captura del diálogo de Android encima: al imprimir la lámina,
   el teléfono abre SU cuadro de «Guardar como PDF» con su propia lista de
   papeles —Ficha 5x8, Folio, Monarca, Oficio, Tabloide, ANSI C/D/E/F, Arch
   A/B/C— y ninguno mide 90 × 60. El `@page { size: 900mm 600mm }` de la hoja
   lo respeta un navegador de escritorio; el servicio de impresión del sistema
   lo ignora y encaja el pliego en el papel que él eligió. Dicho así: «no me
   sale el pliego que yo necesito; sería bueno que salga directamente en PDF
   en el formato que yo quiero».

   Así que el PDF se arma en el teléfono (js/75) y se baja como archivo. Esta
   prueba comprueba lo único que no se puede comprobar mirando: que el archivo
   que baja sea un PDF de verdad, de una página, y que esa página mida 900 ×
   600 mm — no «parecido», los milímetros exactos, porque de eso se trataba.

   Y que el camino viejo siga estando para quien quiera mandarlo a una
   impresora.                                                               */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs'), path = require('path');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.004;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];
const usos = [];
for (let i = 0; i < 60; i++) {
  const a = i * 7 * Math.PI / 180, d = (140 + (i % 4) * 50) / 111320;
  usos.push({ type: 'node', id: 1000 + i, lat: C.lat + Math.cos(a) * d, lon: C.lng + Math.sin(a) * d,
    tags: { name: 'Establecimiento ' + i, amenity: ['pharmacy', 'school', 'bank'][i % 3] } });
}

// Milímetros a puntos, que es la unidad del papel dentro de un PDF.
const PT = mm => mm * 72 / 25.4;

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    acceptDownloads: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
    /* Solo en el marco principal. `addInitScript` corre en TODOS los marcos, y
     la aplicación crea uno escondido para medir la lámina antes de imprimirla:
     sin esta guarda, ese marco volvía a ejecutar esto y borraba las fichas ya
     guardadas a mitad de la prueba. Costó encontrarlo porque el síntoma era
     «no se guardó» en suites que no tocan el guardado. */
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'martarojas', rol: 'admin',
        es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('pcr_fichas_v1'); localStorage.removeItem('aia_overpass_cache_v1');
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
  await ctx.route(/overpass/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: usos }) }));
  await ctx.route(/ags\.esri\.co/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ features: [{ attributes: { TOTAL: 3045, N: 42 } }] }) }));

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 160)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);
  const r = {};

  r.hayModulo = await pg.evaluate(() => !!(window.URBIS_PLIEGO_PDF &&
    typeof window.URBIS_PLIEGO_PDF.generar === 'function' && window.URBIS_PLIEGO_PDF.disponible()));

  // ── Un sector analizado, con nombre.
  await pg.evaluate(async (D) => {
    const { C, POL } = D, esperar = ms => new Promise(x => setTimeout(x, ms));
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    window.map.setView([C.lat, C.lng], 15); await esperar(400);
    const A = window.URBIS_PC_ANALISIS, R = window.URBIS_PC_RECON;
    const bPC = document.querySelector('[data-u52-call="procity-open-map"]');
    if (bPC) { bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p => A.agregarPunto(p.lat, p.lng)); A.agregarPunto(POL[0].lat, POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1400);
    const H = document.getElementById('pcr-hoja');
    const a = H.querySelector('[data-pcr="agrandar"]'); if (a) { a.click(); await esperar(400); }
    const caja = document.getElementById('pcr-nombre');
    if (caja) { caja.value = 'La Playa'; caja.dispatchEvent(new Event('input', { bubbles: true })); }
  }, { C, POL });

  /* ── El botón baja un archivo, sin abrir ninguna otra pestaña ──────────
     Que no se abra otra ventana es la mitad de lo que se pidió: en el
     teléfono, esa ventana es el cuadro de impresión del sistema. */
  let otraPestana = 0;
  ctx.on('page', () => { otraPestana++; });
  const esperaBajada = pg.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await pg.evaluate(async () => {
    const H = document.getElementById('pcr-hoja');
    const bh = H.querySelector('[data-pcr="lamina-h"]');
    if (bh) bh.click();
  });
  const bajada = await esperaBajada;
  r.hayBajada = !!bajada;
  r.nombre = bajada ? bajada.suggestedFilename() : '';
  let pdf = null;
  if (bajada) {
    const destino = path.join(S, 'pliego-directo.pdf');
    await bajada.saveAs(destino);
    pdf = fs.readFileSync(destino);
  }
  r.otraPestana = otraPestana;
  r.bytes = pdf ? pdf.length : 0;
  await pg.waitForTimeout(600);
  r.aviso = await pg.evaluate(() => {
    const a = document.querySelector('#pcr-hoja .pcr-aviso, #pcr-hoja .pcr-ok, #pcr-hoja .pcr-conc');
    const t = (document.getElementById('pcr-hoja') || {}).textContent || '';
    return (t.match(/Lámina bajada[^.]*\./) || [''])[0];
  });
  // Y el camino de siempre, para mandarlo a una impresora de verdad.
  r.hayVerImprimir = await pg.evaluate(() =>
    !!document.querySelector('#pcr-hoja [data-pcr="lamina-ver-h"]'));
  /* ── Y ahora, con el lienzo roto a propósito ─────────────────────────
     Se le hace devolver un lienzo que no dibuja nada, que es como se porta un
     teléfono sin memoria para una imagen de este tamaño: no lanza ningún
     error, deja el papel en blanco. */
  let pestanasDespues = 0;
  ctx.on('page', () => { pestanasDespues++; });
  r.sinLienzo = await pg.evaluate(async () => {
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    const antes = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, o2) {
      const c = antes.call(this, t, o2);
      if (c && this.width > 2000) { c.drawImage = function () {}; }   // no dibuja
      return c;
    };
    const H = document.getElementById('pcr-hoja');
    const b2 = H.querySelector('[data-pcr="lamina-h"]');
    if (b2) b2.click();
    for (let i = 0; i < 60; i++) { await esperar(500);
      if (/No se pudo armar el PDF/.test(H.textContent || '')) break; }
    HTMLCanvasElement.prototype.getContext = antes;
    const t = H.textContent || '';
    return { fallo: /No se pudo armar el PDF/.test(t),
      enPantalla: (t.match(/No se pudo armar el PDF[^]{0,120}/) || [''])[0],
      mensaje: '' };
  });
  r.sinLienzo.pestanas = pestanasDespues;

  /* ── El ruido de las protecciones de identificación ───────────────────
     Llegó con una captura: «no se pudo componer la imagen del pliego (120
     ppp: no cupo; 96 ppp: no cupo; 72 ppp: no cupo)». Los tres. Y a 72 ppp un
     pliego son 2.551 × 1.701 píxeles —cuatro megapíxeles y medio, lo que
     dibuja cualquier teléfono de hace diez años—, así que la memoria no era.

     Era la comprobación de que el lienzo servía: pintaba un píxel de un color
     conocido y exigía los tres canales EXACTOS. Varios navegadores, y casi
     todos en modo privado, alteran a propósito lo que devuelve `getImageData`
     unas pocas unidades para que una página no pueda identificar el aparato
     por cómo dibuja. Con esa protección puesta, la igualdad exacta no se
     cumple NUNCA, a ningún tamaño, y el pliego se declaraba imposible en un
     teléfono perfectamente capaz.

     Acá se imita esa protección con un desvío fijo por canal —así se porta:
     mueve unas unidades, no borra el dibujo— y se pide lo que el usuario
     pedía: que el PDF salga igual.                                        */
  const HOJA_PRUEBA =
    '<html><head><style>html,body{margin:0;font-family:system-ui,sans-serif;color:#123}' +
    '.a{background:#1e6fbf;color:#fff;padding:60px;font-size:90px}' +
    '.b{padding:60px;font-size:60px}</style></head>' +
    '<body><div class="a">URBIS · pliego de prueba</div>' +
    '<div class="b">Con el lienzo alterado por la protección del navegador.</div></body></html>';

  r.ruido = await pg.evaluate(async (html) => {
    const antes = CanvasRenderingContext2D.prototype.getImageData;
    let lecturas = 0;
    // Un desvío FIJO: eso es lo que hace la protección de verdad. Mueve el
    // color, no lo inventa, así que las diferencias entre puntos siguen ahí.
    CanvasRenderingContext2D.prototype.getImageData = function () {
      const d = antes.apply(this, arguments), p = d.data;
      lecturas++;
      for (let i = 0; i < p.length; i += 4) {
        p[i]     = Math.min(255, p[i] + 9);
        p[i + 1] = Math.max(0, p[i + 1] - 7);
        p[i + 2] = Math.min(255, p[i + 2] + 11);
      }
      return d;
    };
    let sale = null, error = '';
    try {
      const g = await window.URBIS_PLIEGO_PDF.generar(html, { titulo: 'ruido' });
      sale = { dpi: g.dpi, bytes: g.bytes, ancho: g.ancho, alto: g.alto };
    } catch (e) { error = String((e && e.message) || e); }
    CanvasRenderingContext2D.prototype.getImageData = antes;
    return { sale: sale, error: error, lecturas: lecturas };
  }, HOJA_PRUEBA);

  /* ── Y con ruido Y sin dibujo: sigue diciendo que no ──────────────────
     La tolerancia de arriba se puede aflojar de más y dejar pasar cualquier
     cosa. Esto es el otro lado: con la misma protección puesta, un lienzo que
     no dibuja nada tiene que seguir cazándose. Lo caza la comprobación que
     mira DIFERENCIAS entre treinta y seis puntos, que un desvío fijo no
     borra; si alguien la aflojara también, acá bajaría un pliego en blanco. */
  r.ruidoEnBlanco = await pg.evaluate(async (html) => {
    const antesG = CanvasRenderingContext2D.prototype.getImageData;
    const antesD = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.getImageData = function () {
      const d = antesG.apply(this, arguments), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        p[i]     = Math.min(255, p[i] + 9);
        p[i + 1] = Math.max(0, p[i + 1] - 7);
        p[i + 2] = Math.min(255, p[i + 2] + 11);
      }
      return d;
    };
    CanvasRenderingContext2D.prototype.drawImage = function () {};
    let bajo = false, error = '';
    try { await window.URBIS_PLIEGO_PDF.generar(html, {}); bajo = true; }
    catch (e) { error = String((e && e.message) || e); }
    CanvasRenderingContext2D.prototype.getImageData = antesG;
    CanvasRenderingContext2D.prototype.drawImage = antesD;
    return { bajo: bajo, error: error };
  }, HOJA_PRUEBA);

  /* ── El mismo botón, desde el sector guardado ────────────────────────── */
  const esperaGuardada = pg.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  r.guardado = await pg.evaluate(async () => {
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    const R = window.URBIS_PC_RECON;
    const H = document.getElementById('pcr-hoja');
    const g = H.querySelector('[data-pcr="guardar"]'); if (g) { g.click(); await esperar(700); }
    R.cerrar(); await esperar(200);
    let imprimio = false;
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function () { imprimio = true; return true; };
    if (typeof window.urbisProCityAbrirSector === 'function') window.urbisProCityAbrirSector();
    await esperar(800);
    const cab = document.querySelector('.pcr-pest-cab'); if (cab) { cab.click(); await esperar(700); }
    const cuerpo = document.querySelector('.pcr-pest-ficha.abierta .pcr-pest-cuerpo');
    const botones = cuerpo ? [...cuerpo.querySelectorAll('button')].map(x => (x.textContent || '').trim()).join(' | ') : '';
    const bl = cuerpo ? cuerpo.querySelector('[data-u52-call="pcr-lamina-h"]') : null;
    if (bl) bl.click();
    await esperar(2500);
    return { fichas: (R.leerFichas() || []).length, botones: botones, imprimio: imprimio };
  });
  const bajada2 = await esperaGuardada;
  r.guardado.bajo = !!bajada2;
  r.guardado.nombre = bajada2 ? bajada2.suggestedFilename() : '';

  r.err = err;
  await pg.close(); await b.close();

  const txt = pdf ? pdf.toString('latin1') : '';
  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

  console.log('\n  -- el módulo está --');
  T('js/75 carga y dice que puede', r.hayModulo);

  console.log('\n  -- tocar «Lámina 90×60 · PDF» --');
  T('baja un archivo', r.hayBajada);
  T('con nombre de lámina y su tamaño', /URBIS-lamina-.*90x60\.pdf$/.test(r.nombre || ''), r.nombre || '(sin nombre)');
  T('y sin abrir ninguna otra pestaña', r.otraPestana === 0, r.otraPestana + ' pestañas');
  T('la ficha dice qué bajó y dónde está', /Lámina bajada/.test(r.aviso || ''), r.aviso || '(no dice nada)');

  console.log('\n  -- el archivo es un PDF de verdad --');
  T('empieza como un PDF', txt.slice(0, 8) === '%PDF-1.4', JSON.stringify(txt.slice(0, 8)));
  T('y termina cerrado', /%%EOF\s*$/.test(txt));
  T('pesa lo que pesa una lámina, no cuatro bytes', r.bytes > 200000,
    Math.round(r.bytes / 1024) + ' KB');
  T('trae una sola página', /\/Type\s*\/Pages[^>]*\/Count 1/.test(txt));
  /* El punto de todo esto: los milímetros. 900 × 600 mm son 2551,18 × 1700,79
     puntos, y es lo que tiene que decir la caja de la página. */
  const caja = (txt.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/) || []);
  const anchoPt = Number(caja[1] || 0), altoPt = Number(caja[2] || 0);
  T('la página mide 90 × 60 cm, no carta ni oficio',
    Math.abs(anchoPt - PT(900)) < 0.5 && Math.abs(altoPt - PT(600)) < 0.5,
    anchoPt + ' × ' + altoPt + ' pt = ' + Math.round(anchoPt / 72 * 25.4) + ' × ' +
    Math.round(altoPt / 72 * 25.4) + ' mm');
  T('con la lámina dentro, como imagen', /\/Subtype \/Image/.test(txt) && /\/Filter \/DCTDecode/.test(txt));
  /* La tabla de posiciones es lo único que puede estar mal sin que se note al
     escribirla: si un desplazamiento no cae donde empieza su objeto, el
     archivo abre en unos lectores y en otros no. Se comprueba el primero. */
  const startxref = Number((txt.match(/startxref\s+(\d+)/) || [])[1] || -1);
  T('la tabla de posiciones apunta a donde debe',
    startxref > 0 && txt.slice(startxref, startxref + 4) === 'xref',
    'startxref ' + startxref + ' → ' + JSON.stringify(txt.slice(startxref, startxref + 4)));
  const prim = Number((txt.match(/xref\n0 7\n0000000000 65535 f \n(\d{10})/) || [])[1] || -1);
  T('y el primer objeto empieza donde dice',
    prim > 0 && /^1 0 obj/.test(txt.slice(prim, prim + 8)),
    prim + ' → ' + JSON.stringify(txt.slice(prim, prim + 8)));

  /* Y si el teléfono no puede con la imagen, NO se cae en silencio al cuadro
     de impresión del sistema. Eso es lo que pasaba: el PDF fallaba al final
     —reservar el lienzo es barato, dibujar dieciocho millones de píxeles y
     comprimirlos no—, se abría el cuadro azul de Android con su lista de
     papeles, y desde afuera parecía que el botón nuevo no hacía nada. */
  console.log('\n  -- si no puede, lo dice --');
  T('sin lienzo no devuelve un PDF en blanco', r.sinLienzo && r.sinLienzo.fallo === true,
    (r.sinLienzo || {}).mensaje || 'no falló');
  T('la ficha lo explica en vez de abrir el cuadro del teléfono',
    /No se pudo armar el PDF/.test((r.sinLienzo || {}).enPantalla || ''),
    ((r.sinLienzo || {}).enPantalla || '(no dice nada)').slice(0, 90));
  T('y no abre ninguna otra pestaña', (r.sinLienzo || {}).pestanas === 0,
    (r.sinLienzo || {}).pestanas + ' pestañas');

  /* Y lo que traía la captura del error: los tres «no cupo» seguidos en un
     teléfono que sí podía. */
  console.log('\n  -- con el lienzo alterado por la protección del navegador --');
  T('el pliego sale igual, no dice «no cupo»',
    !!(r.ruido && r.ruido.sale), (r.ruido || {}).error || 'salió');
  T('y sale del tamaño de siempre, no de uno recortado',
    !!(r.ruido && r.ruido.sale && r.ruido.sale.bytes > 100000 && r.ruido.sale.dpi >= 72),
    r.ruido && r.ruido.sale
      ? r.ruido.sale.dpi + ' ppp · ' + Math.round(r.ruido.sale.bytes / 1024) + ' KB · ' +
        r.ruido.sale.ancho + '×' + r.ruido.sale.alto + ' px'
      : '(no salió)');
  T('la comprobación del lienzo se hizo de verdad, no se saltó',
    (r.ruido || {}).lecturas > 0, ((r.ruido || {}).lecturas || 0) + ' lecturas');
  T('pero con ruido Y sin dibujo sigue diciendo que no',
    (r.ruidoEnBlanco || {}).bajo === false,
    (r.ruidoEnBlanco || {}).bajo ? 'bajó un pliego en blanco' : ((r.ruidoEnBlanco || {}).error || '').slice(0, 70));

  /* Y desde la pestaña «Sector», que es el otro sitio donde vive el mismo
     botón. Ese camino se quedó con el de antes —abrir la vista de impresión—
     y por eso el mismo botón seguía llevando al cuadro de papeles del
     teléfono: «le doy donde dice lámina y me sale la opción de PDF/imprimir».
     Dos sitios que hacen lo mismo tienen que hacerlo igual. */
  console.log('\n  -- y también desde un sector guardado --');
  T('el sector quedó archivado', (r.guardado || {}).fichas >= 1,
    ((r.guardado || {}).fichas || 0) + ' fichas');
  T('la pestaña ofrece la lámina como PDF',
    /Lámina 90×60 · PDF/.test((r.guardado || {}).botones || ''),
    ((r.guardado || {}).botones || '(sin botones)').slice(0, 80));
  T('y tocarla baja un archivo, sin abrir la vista de impresión',
    (r.guardado || {}).bajo === true && (r.guardado || {}).imprimio === false,
    'bajó:' + (r.guardado || {}).bajo + ' · vista de impresión:' + (r.guardado || {}).imprimio);
  T('con nombre de lámina y su tamaño',
    /90x60\.pdf$/.test((r.guardado || {}).nombre || ''), (r.guardado || {}).nombre || '(sin nombre)');

  console.log('\n  -- y el camino de antes sigue --');
  T('se puede ver e imprimir, para una impresora de verdad', r.hayVerImprimir);

  console.log('');
  T('sin errores de JavaScript', (r.err || []).length === 0, (r.err || []).join(' | ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
