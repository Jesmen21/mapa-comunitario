const E = require('../entorno.js');
/* El pliego, con un lote de muchos lados y los mapas a un tamaño que se lee.

   Dos cosas que llegaron juntas, con una captura de la lámina en la mano:

     «aquí se sale de la hoja»

     «los mapas salen muy pequeños, deberíamos hacerlos más grandes para que
      un profesor pase y vea con más detalle lo mapeado; no se ve con claridad
      los rasters o los llenos y vacíos»

   Lo primero era un lote de 193.863 m² con veintidós lados. La caja del lote
   ponía un renglón por lado, crecía a 283 mm, y como las bandas de una fila
   se estiran hasta la más alta, la fila entera crecía con ella: el pliego
   acostado pedía 652 mm de los 600 que tiene y lo de abajo se imprimía fuera
   del papel. Un lote de cuatro esquinas no lo destapaba nunca, y por eso las
   pruebas de la lámina —que no dibujan lote— pasaban en verde mientras el
   pliego del usuario se cortaba.

   Lo segundo se veía en los números: la banda de mapas tiene 505 mm de ancho
   útil, cada recuadro salía de 98 mm de ancho, y el dibujo tenía un techo de
   alto FIJO de 40 mm. Un dibujo de proporción 260 × 180 metido en 98 × 40 se
   encoge hasta caber en el alto: queda de 58 mm y centrado, con dos bandas
   blancas de 20 mm a los lados. Se pagaba el papel y no se usaba.

   Así que esta prueba dibuja el lote de veintidós lados que lo destapó, lee
   una foto de mentira para que estén los dos rasters, monta las dos láminas a
   tamaño real y mide el papel: que nada se salga, que la caja del lote diga
   el reparto en vez de veintidós renglones, y que cada mapa LLENE su recuadro
   —se compara la proporción del hueco con la del `viewBox`, que es la única
   forma de ver un dibujo encogido dentro de su propio marco—.                */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.006;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];
/* El lote de la captura: grande, irregular y de veintidós lados. Los radios
   se mueven a propósito para que los lados salgan de largos distintos y el
   reparto por sol tenga algo que repartir. */
const NL = 22, RL = 0.0022;
const LOTE = [];
for (let i = 0; i < NL; i++) {
  const a = i * 2 * Math.PI / NL, rr = RL * (0.75 + 0.5 * ((i * 7) % 5) / 4);
  LOTE.push({ lat: C.lat + Math.cos(a) * rr,
              lng: C.lng + Math.sin(a) * rr / Math.cos(C.lat * Math.PI / 180) });
}
const usos = [];
for (let i = 0; i < 220; i++) {
  const a = i * 11 * Math.PI / 180, d = (120 + (i % 7) * 70) / 111320;
  usos.push({ type: 'node', id: 2000 + i, lat: C.lat + Math.cos(a) * d, lon: C.lng + Math.sin(a) * d,
    tags: { name: 'Sitio ' + i, amenity: ['pharmacy', 'school', 'bank', 'restaurant', 'police'][i % 5] } });
}
const cotaDe = ln => 300 + Math.round(40 * Math.sin(ln * 900));
/* Calles con jerarquía de verdad, que es lo que pide el mapa de movilidad:
   una troncal, dos principales, dos secundarias, dos colectoras y un puñado
   de locales y senderos. Sin esto el sector no tiene red y el mapa que se
   pidió —«las vías principales de un color verde y las secundarias de otro»—
   no tendría nada que dibujar. */
const GLAT = m => m / 110540, GLNG = m => m / (111320 * Math.cos(C.lat * Math.PI / 180));
const P = (dx, dy) => ({ lat: C.lat + GLAT(dy), lng: C.lng + GLNG(dx) });
let gid = 90000;
const via = (nombre, clase, pts) => ({ type: 'way', id: gid++,
  tags: { highway: clase, name: nombre, lanes: '2' },
  geometry: pts.map(p => ({ lat: p.lat, lon: p.lng })) });
const edif = (dx, dy, w2, h2, pisos) => ({ type: 'way', id: gid++,
  tags: { building: 'yes', 'building:levels': String(pisos) },
  geometry: [P(dx, dy), P(dx + w2, dy), P(dx + w2, dy + h2), P(dx, dy + h2), P(dx, dy)]
    .map(p => ({ lat: p.lat, lon: p.lng })) });
const geo = [
  via('Autopista Nacional', 'trunk', [P(-600, -500), P(-100, 0), P(600, 500)]),
  via('Avenida 1', 'primary', [P(-600, 200), P(0, 200), P(600, 200)]),
  via('Avenida 3', 'primary', [P(-300, -600), P(-300, 0), P(-300, 600)]),
  via('Calle 8', 'secondary', [P(-600, -200), P(0, -200), P(600, -200)]),
  via('Calle 12', 'secondary', [P(200, -600), P(200, 0), P(200, 600)]),
  via('Carrera 5', 'tertiary', [P(-600, 400), P(600, 400)]),
  via('Carrera 9', 'tertiary', [P(-500, -400), P(500, -400)])
].concat(
  Array.from({ length: 12 }, (_, i) => via('Calle interior ' + i, 'residential',
    [P(-600 + i * 100, -600), P(-600 + i * 100, 600)])),
  Array.from({ length: 6 }, (_, i) => via('Sendero ' + i, 'footway',
    [P(-400, -500 + i * 180), P(400, -500 + i * 180)])),
  Array.from({ length: 30 }, (_, i) => edif(-560 + (i % 10) * 115,
    -400 + Math.floor(i / 10) * 220, 60, 90, 3 + (i % 5)))
);

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
  await ctx.route(/overpass/, r => {
    // La consulta con geometría trae calles y edificios; la de usos, los POI.
    const q = (r.request().postData() || '') + r.request().url();
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos }) });
  });
  await ctx.route(/ags\.esri\.co/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ features: [{ attributes: { TOTAL: 3045, N: 42 } }] }) }));
  await ctx.route(/elevation/, r => { const u = new URL(r.request().url());
    const lngs = (u.searchParams.get('locations') || '').split('|');
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elevation: lngs.map(cotaDe) }) }); });

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r = await pg.evaluate(async (D) => {
    const { C, POL, LOTE } = D, o = {}, esperar = ms => new Promise(x => setTimeout(x, ms));
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    window.map.setView([C.lat, C.lng], 15); await esperar(500);
    const A = window.URBIS_PC_ANALISIS, R = window.URBIS_PC_RECON;
    let capturado = '';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function (h) { capturado = h; };
    const bPC = document.querySelector('[data-u52-call="procity-open-map"]');
    if (bPC) { bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p => A.agregarPunto(p.lat, p.lng)); A.agregarPunto(POL[0].lat, POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);
    const H = () => document.getElementById('pcr-hoja');

    // ── El lote de veintidós lados, tocado esquina por esquina.
    const bf = [...H().querySelectorAll('button')].filter(x => /El lote y su entorno/.test(x.textContent || ''))[0];
    if (bf) { bf.click(); await esperar(400); }
    const bd = H().querySelector('[data-pcr="lote-dibujar"]');
    if (bd) { bd.click(); await esperar(500); }
    for (const p of LOTE) { window.map.fire('click', { latlng: { lat: p.lat, lng: p.lng } }); await esperar(40); }
    o.lados = (R.loteDePrueba() || []).length;
    const bc = document.querySelector('#pcr-lote-barra [data-lote="cerrar"]');
    if (bc) { bc.click(); await esperar(900); }
    R.abrir(); await esperar(500);
    const asa = H().querySelector('[data-pcr="agrandar"]'); if (asa) { asa.click(); await esperar(400); }

    // ── Y una medición, para que la hoja vaya llena como la de la captura.
    const medir = async (acc, sel) => {
      const x = H().querySelector('[data-pcr="' + acc + '"]');
      if (!x) return false;
      x.click();
      for (let i = 0; i < 70 && !document.querySelector(sel); i++) await esperar(400);
      await esperar(250); return !!document.querySelector(sel);
    };
    await esperar(5200);   // el limitador de Overpass: se espera, como una persona
    o.trazado = await medir('trazado', '.pcr-llenos');

    /* ── La foto, de mentira ────────────────────────────────────────────
       Acá se mide el PAPEL, no el clasificador: lo único que hace falta es
       que la lámina reciba una cobertura con sus dos imágenes y sus límites,
       que es lo que pone los dos recuadros anchos —los rasters— en la banda
       de mapas. El clasificador de verdad tiene su propia suite. */
    const pinta = (c1, c2) => {
      const cv = document.createElement('canvas'); cv.width = 260; cv.height = 180;
      const x = cv.getContext('2d');
      for (let i = 0; i < 260; i += 10) for (let j = 0; j < 180; j += 10) {
        x.fillStyle = ((i + j) / 10) % 2 ? c1 : c2; x.fillRect(i, j, 10, 10);
      }
      return cv.toDataURL('image/png');
    };
    const lim = [[C.lat - 0.006, C.lng - 0.006], [C.lat + 0.006, C.lng + 0.006]];
    A.analizarRaster = function (avisar) {
      if (avisar) avisar('leyendo');
      return Promise.resolve({ pixeles: 40000, imagen: pinta('#5a7f4a', '#8b8f7a'),
        overlayImagen: pinta('#22c55e', '#94a3b8'), overlayLimites: lim,
        clases: [{ id: 'verde', etq: 'Vegetación viva', color: '#22c55e', pct: 38, m2: 9000, fiable: true },
                 { id: 'construido', etq: 'Superficie dura gris', color: '#94a3b8', pct: 44, m2: 10400, fiable: true },
                 { id: 'agua', etq: 'Agua', color: '#3b82f6', pct: 3, m2: 700, fiable: true },
                 { id: 'suelo', etq: 'Suelo desnudo', color: '#a16207', pct: 15, m2: 3500, fiable: false }] });
    };
    const bcob = H().querySelector('[data-pcr="cobertura"]');
    if (bcob) { bcob.click(); await esperar(1600); }
    o.cobertura = !!R.cobertura();

    const cn = document.getElementById('pcr-nombre');
    if (cn) { cn.value = 'La Playa'; cn.dispatchEvent(new Event('input', { bubbles: true })); }
    const bv = H().querySelector('[data-pcr="lamina-ver"]');
    if (bv) { bv.click(); await esperar(500); }
    o.v = capturado; capturado = '';
    const bh = H().querySelector('[data-pcr="lamina-ver-h"]');
    if (bh) { bh.click(); await esperar(500); }
    o.h = capturado; capturado = '';
    return o;
  }, { C, POL, LOTE });

  /* Cada lámina, montada a tamaño real y medida. Lo que se mira: el alto que
     el contenido PIDE con la hoja suelta —que es la holgura de verdad, no la
     que el reparto del papel disimula—, y el hueco de cada mapa contra su
     `viewBox`. */
  const medir = async (html, w, h) => {
    const m = await ctx.newPage();
    await m.setViewportSize({ width: w, height: h });
    await m.setContent(html || '<i></i>', { waitUntil: 'load' });
    await m.waitForTimeout(600);
    const out = await m.evaluate(() => {
      const hoja = document.querySelector('.hoja');
      const rej = document.querySelector('.rej'), marco = document.querySelector('.rejilla');
      if (!hoja || !rej || !marco) return null;
      /* Lo que el contenido PIDE, con la hoja ya compuesta a la escala que le
         tocó. Se mide la rejilla con `getBoundingClientRect` —que SÍ cuenta la
         reducción— contra el marco que la recorta, y se le suman cabecera y
         pie. Con `scrollHeight` de la hoja no serviría: devuelve el tamaño sin
         reducir y diría que se pasa siempre. */
      const pide = Math.round(rej.getBoundingClientRect().height +
        (hoja.clientHeight - marco.getBoundingClientRect().height));
      const esc = (function () {
        const t = getComputedStyle(rej).transform;
        const mm = t && t !== 'none' ? t.match(/matrix\(([\d.]+)/) : null;
        return mm ? Number(mm[1]) : 1;
      })();
      return {
        ancho: hoja.clientWidth, papel: hoja.clientHeight, pide: pide, escala: esc,
        recortadas: [...document.querySelectorAll('.caja')]
          .filter(c => c.scrollHeight > c.clientHeight + 2)
          .map(c => ((c.querySelector('h2') || {}).textContent || '?')),
        mapas: [...document.querySelectorAll('.mapa-caja')].map(f => {
          const s = f.querySelector('.mp-dib svg'), d = f.querySelector('.mp-dib');
          const sb = s ? s.getBoundingClientRect() : { width: 0, height: 0 };
          const vb = String((s && s.getAttribute('viewBox')) || '').trim().split(/\s+/).map(Number);
          return { t: ((f.querySelector('h2') || {}).textContent || '?'),
            banda: f.getAttribute('data-g') || '',
            hueco: Math.round(d ? d.getBoundingClientRect().width : 0),
            w: Math.round(sb.width), h: Math.round(sb.height),
            // La proporción del dibujo mismo, para saber si se encogió dentro.
            propVB: (vb.length === 4 && vb[3]) ? vb[2] / vb[3] : 0,
            propHueco: sb.height ? sb.width / sb.height : 0 };
        })
      };
    });
    await m.close();
    return out;
  };
  const V = await medir(r.v, 2268, 3402);
  const HZ = await medir(r.h, 3402, 2268);
  await pg.close(); await b.close();

  fs.writeFileSync(S + 'pliego-lote-v.html', r.v || '', 'utf8');
  fs.writeFileSync(S + 'pliego-lote-h.html', r.h || '', 'utf8');

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };
  // De píxeles del medidor a milímetros de papel, que es la unidad en la que
  // se decidió todo esto.
  const mmDe = (o, hojaMM) => px => Math.round(px / o.ancho * hojaMM);

  console.log('\n  -- el sector, con un lote de muchos lados --');
  T('el lote quedó de veintidós lados', r.lados === 22, r.lados + ' lados');
  T('y la foto está leída, así que hay rasters', r.cobertura === true);
  T('salieron las dos láminas', (r.v || '').length > 20000 && (r.h || '').length > 20000,
    Math.round((r.v || '').length / 1024) + ' KB · ' + Math.round((r.h || '').length / 1024) + ' KB');

  [['acostada 90 × 60', HZ, 900], ['parada 60 × 90', V, 600]].forEach(([nom, o, hojaMM]) => {
    console.log('\n  -- ' + nom + ': el papel aguanta --');
    if (!o) { T('la lámina se pudo montar', false, 'no hay hoja'); return; }
    const mm = mmDe(o, hojaMM);
    /* Lo que se salía. Se mide con la hoja SUELTA y no por el desbordamiento:
       con la altura fija, el reparto del papel esconde el problema hasta que
       la impresora corta. */
    /* La hoja no crece y el contenido de un sector bien trabajado se pasa:
       se compone más chica hasta cerrar, y lo que se comprueba es que CIERRE.
       Se mide la rejilla ya reducida, no el tamaño sin reducir. */
    T('el contenido cabe en la hoja, no la desborda',
      o.pide <= o.papel + 2, (o.pide <= o.papel + 2
        ? 'sobran ' + mm(o.papel - o.pide) + ' mm'
        : 'SE PASA ' + mm(o.pide - o.papel) + ' mm') +
        ' · compuesta al ' + Math.round(o.escala * 100) + '%');
    T('y ninguna caja se recorta por dentro',
      (o.recortadas || []).length === 0, (o.recortadas || []).join(' · ') || 'ninguna');

    console.log('\n  -- ' + nom + ': los mapas se ven y están todos --');
    const mapas = o.mapas || [];
    /* Ni uno a un lado. Se pidió con todas las letras después de ver una
       versión que dejaba solo cuatro: «veo 10 mapas en el último análisis que
       hice, no me dejes mapas a un lado». Acá se midieron cinco capas —los dos
       rasters, los llenos, la jerarquía vial y los usos— y las cinco tienen
       que estar en el papel. */
    T('están todos los que se midieron, ninguno a un lado', mapas.length >= 5,
      mapas.length + ' mapas: ' + mapas.map(m => m.t).join(' · '));
    /* Y cada uno en la banda de SU tema, que es la otra mitad de lo que se
       pidió: «en vez de que los mapas salgan en una sola línea, que se
       integren dependiendo el tema». Un mapa sin banda es un mapa suelto. */
    const sinBanda = mapas.filter(m => !m.banda);
    T('y cada uno en la banda de su tema, no en una tira suelta',
      sinBanda.length === 0 && new Set(mapas.map(m => m.banda)).size >= 3,
      mapas.map(m => m.banda + ':' + m.t).join(' · '));
    T('la jerarquía vial va con la movilidad',
      mapas.some(m => /Jerarquía vial/.test(m.t) && m.banda === 'movilidad'),
      (mapas.filter(m => /Jerarquía vial/.test(m.t))[0] || {}).banda || 'no está');
    /* El tamaño, en milímetros de papel. En la tira que se quitó, un recuadro
       normal medía 40 mm de alto acostado y el dibujo de adentro se encogía a
       58 mm de ancho dentro de un hueco de 96. */
    const altoMin = Math.min.apply(null, mapas.map(m => mm(m.h)));
    T('ninguno baja de 45 mm de alto', altoMin >= 45, altoMin + ' mm el más bajo);'.slice(0, -2));
    /* ── Que el sector LLENE el dibujo ────────────────────────────────
       El recuadro tenía la proporción fija 260 × 180 sin importar la forma del
       sector, así que un sector cuadrado —el de esta prueba lo es— salía
       flotando en el medio con dos franjas de rejilla a los lados y se veía
       la mitad de grande de lo que podía. Se reportó así: «quiero el cuadrado
       que estás analizando más grande y no sobrealargarlo de más».

       Se comprueba sobre el `viewBox`, que es donde vive la decisión: si el
       sector es cuadrado, el recuadro tiene que ser cuadrado. Con el 260 × 180
       de antes esto da 1,44 y falla. */
    const torcidos = mapas.filter(m => Math.abs(m.propVB - 1) > 0.15);
    T('el recuadro tiene la forma del sector, no una fija',
      torcidos.length === 0,
      torcidos.map(m => m.t + ': ' + m.propVB.toFixed(2)).join(' · ') ||
        'todos a la forma del sector (' + (mapas[0] || {}).propVB.toFixed(2) + ')');
    /* Y que el dibujo use su caja. Queda algo de blanco cuando la caja es más
       ancha que el sector —el reparto de la banda no puede darle a cada mapa
       una caja con su forma exacta—, pero de ahí a que el dibujo ocupe media
       caja hay un trecho, y ese trecho es el que se estaba perdiendo. */
    const aprovecha = m => (m.hueco > 0 ? Math.min(m.w, m.h * (m.propVB || 1)) / m.hueco : 0);
    const flacos = mapas.filter(m => aprovecha(m) < 0.6);
    T('y el dibujo ocupa su caja, no la mitad',
      flacos.length === 0,
      flacos.map(m => m.t + ': ' + Math.round(aprovecha(m) * 100) + '%').join(' · ') ||
        'del ' + Math.round(Math.min.apply(null, mapas.map(aprovecha)) * 100) + '% para arriba');
  });

  console.log('\n  -- la caja del lote dice el reparto, no veintidós renglones --');
  const cajaLote = (r.h || '').split('<section class="caja')
    .filter(t => /<h2>El lote a intervenir<\/h2>/.test(t))[0] || '';
  const renglones = (cajaLote.match(/>Lado \d+/g) || []).length;
  T('la caja del lote está en la lámina', !!cajaLote);
  T('no pone un renglón por lado', renglones > 0 && renglones <= 8,
    renglones + ' renglones de «Lado N» para 22 lados');
  T('reparte los lados por cuánto sol reciben',
    /(Sol pleno de la tarde|Sol fuerte|Sol medio|Poco sol|Sin sol de la tarde)<\/span><b>\d+ lados? · \d+ m/.test(cajaLote),
    (cajaLote.match(/>(?:Sol|Poco|Sin)[^<]*<\/span><b>[^<]*/g) || []).join(' · ').slice(0, 110) || '(no reparte)');
  T('y dice cuántos lados tiene y dónde está el listado entero',
    /22 lados<\/b>/.test(cajaLote) && /listado lado por lado está en la ficha/.test(cajaLote));

  console.log('');
  T('sin errores de JavaScript', err.length === 0, err.join(' | ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
