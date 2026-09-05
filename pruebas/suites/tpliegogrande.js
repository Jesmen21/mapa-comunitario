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

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
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
      if (!hoja) return null;
      const alto = hoja.style.height;
      hoja.style.height = 'auto';
      const pide = hoja.scrollHeight;
      hoja.style.height = alto;
      return {
        ancho: hoja.clientWidth, papel: hoja.clientHeight, pide: pide,
        recortadas: [...document.querySelectorAll('.caja')]
          .filter(c => c.scrollHeight > c.clientHeight + 2)
          .map(c => ((c.querySelector('h2') || {}).textContent || '?')),
        mapas: [...document.querySelectorAll('.mp')].map(f => {
          const s = f.querySelector('svg'), d = f.querySelector('.mp-dib');
          const sb = s ? s.getBoundingClientRect() : { width: 0, height: 0 };
          const vb = String((s && s.getAttribute('viewBox')) || '').trim().split(/\s+/).map(Number);
          return { t: ((f.querySelector('figcaption') || {}).textContent || '?'),
            grande: f.classList.contains('grande'),
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
    T('el contenido cabe en la hoja, no la desborda',
      o.pide <= o.papel, o.pide <= o.papel
        ? 'sobran ' + mm(o.papel - o.pide) + ' mm'
        : 'SE PASA ' + mm(o.pide - o.papel) + ' mm');
    T('y ninguna caja se recorta por dentro',
      (o.recortadas || []).length === 0, (o.recortadas || []).join(' · ') || 'ninguna');

    console.log('\n  -- ' + nom + ': los mapas se ven --');
    const mapas = o.mapas || [];
    const grandes = mapas.filter(m => m.grande);
    T('hay recuadros de mapa', mapas.length >= 3, mapas.length + ' recuadros');
    T('los rasters van al doble de ancho', grandes.length >= 2,
      grandes.map(m => m.t).join(' · ') || 'ninguno ancho');
    /* El tamaño, en milímetros de papel. Antes: 40 mm de alto acostada y 62
       los anchos. Un raster de 40 mm no se lee ni con la nariz pegada. */
    const altoMin = Math.min.apply(null, mapas.map(m => mm(m.h)));
    const altoG = grandes.length ? Math.min.apply(null, grandes.map(m => mm(m.h))) : 0;
    T('ningún recuadro baja de 45 mm de alto', altoMin >= 45, altoMin + ' mm el más bajo');
    T('y los rasters pasan de 90 mm', altoG >= 90, altoG + ' mm el más bajo de los anchos');
    /* Y que el dibujo LLENE su hueco. Un `max-height` fijo no recorta: encoge
       el dibujo entero hasta caber en el alto y lo centra, así que el
       recuadro sigue midiendo lo mismo y el mapa adentro mide la mitad. Se ve
       comparando la proporción del hueco con la del `viewBox`. */
    const torcidos = mapas.filter(m => m.propVB > 0 &&
      Math.abs(m.propHueco - m.propVB) / m.propVB > 0.12);
    T('cada mapa llena su recuadro en vez de encogerse dentro',
      torcidos.length === 0,
      torcidos.map(m => m.t + ' ' + m.w + '×' + m.h + 'px, hueco ' +
        m.propHueco.toFixed(2) + ' contra dibujo ' + m.propVB.toFixed(2)).join(' · ') || 'todos llenos');
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
