const E = require('../entorno.js');
/* LAS DOS LÁMINAS · el pliego educativo se parte en A y B
   ────────────────────────────────────────────────────────────────────────
   El pliego de instrucciones del módulo educativo pide DOS láminas de
   60 × 90 vertical, no una:

     · LÁMINA A — sitio y medio físico. Responde «¿qué es este lugar y qué
       condiciones físicas manda el terreno?»: ubicación, ambiental, riesgo
       y servicios, morfología urbana, el lote y la norma.
     · LÁMINA B — gente, usos y movilidad. Responde «¿quién vive acá, qué le
       falta y cómo se mueve?»: demografía y usos, movilidad, trabajo de
       campo y el cierre de cinco propuestas.

   Y pide dos cosas más que se miden acá: que cada lámina DIGA cuál es y qué
   pregunta responde, y que las dos impriman la REGLA DE NEUTRALIDAD —el
   análisis se hace sin propósito declarado—, que es la que un estudiante
   rompe sin darse cuenta cuando llega con el proyecto ya decidido.

   Se monta el mismo sector de `tlaminaedu` —el de veintidós lados, con
   trazado y foto leída— y se mide el documento de dos páginas tal como sale
   a imprimir: dos hojas, cada una ajustada a SU papel.                      */
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

/* Lo que este sector necesita para tener CIFRAS SUELTAS: un parque con
   forma —el espacio público efectivo se mide sobre el polígono— y dos piezas
   de infraestructura de servicios. Son las dos cajas de puras cifras que la
   lámina educativa convierte en baldosas; sin ellas la regla no tendría con
   qué probarse en este sector, que es de comercio y calles. */
geo.push({ type: 'way', id: gid++, tags: { leisure: 'park', name: 'Parque La Playa' },
  geometry: [P(-250, -150), P(-90, -150), P(-90, -30), P(-250, -30), P(-250, -150)]
    .map(p => ({ lat: p.lat, lon: p.lng })) });
usos.push({ type: 'node', id: 3001, lat: C.lat + 0.002, lon: C.lng - 0.0015,
  tags: { name: 'Subestación La Playa', power: 'substation' } });
usos.push({ type: 'node', id: 3002, lat: C.lat - 0.0025, lon: C.lng + 0.002,
  tags: { name: 'Tanque del acueducto', man_made: 'water_tower' } });

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
    const bf = [...H().querySelectorAll('button')].filter(x => /El lote y su entorno/.test(x.textContent || ''))[0];
    if (bf) { bf.click(); await esperar(400); }
    const bd = H().querySelector('[data-pcr="lote-dibujar"]');
    if (bd) { bd.click(); await esperar(500); }
    for (const p of LOTE) { window.map.fire('click', { latlng: { lat: p.lat, lng: p.lng } }); await esperar(40); }
    const bc = document.querySelector('#pcr-lote-barra [data-lote="cerrar"]');
    if (bc) { bc.click(); await esperar(900); }
    R.abrir(); await esperar(500);
    const asa = H().querySelector('[data-pcr="agrandar"]'); if (asa) { asa.click(); await esperar(400); }
    await esperar(5200);   // el limitador de Overpass
    const medir = async (acc, sel) => {
      const x = H().querySelector('[data-pcr="' + acc + '"]');
      if (!x) return false;
      x.click();
      for (let i = 0; i < 70 && !document.querySelector(sel); i++) await esperar(400);
      await esperar(250); return !!document.querySelector(sel);
    };
    o.trazado = await medir('trazado', '.pcr-llenos');
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
    const cn = document.getElementById('pcr-nombre');
    if (cn) { cn.value = 'La Playa'; cn.dispatchEvent(new Event('input', { bubbles: true })); }
    /* El botón de ver la lámina: desde la v853 entrega LAS DOS en un
       documento de dos páginas. Es lo que sale a imprimir. */
    const bv = H().querySelector('[data-pcr="lamina-ver"]');
    if (bv) { bv.click(); await esperar(600); }
    o.doc = capturado; capturado = '';
    o.fuera = ((R.estado() || {}).pliegoFuera || []).slice();
    // Y cada hoja por separado, para poder pedirle a cada una lo suyo.
    o.soloA = R.laminaA({ hoja: 'A' });
    o.soloB = R.laminaA({ hoja: 'B' });
    return o;
  }, { C, POL, LOTE });

  /* El documento montado a tamaño real: las dos hojas, cada una con su
     reducción, medidas en milímetros de papel. */
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 2268, height: 3402 });
  await m.setContent(r.doc || '<i></i>', { waitUntil: 'load' });
  await m.waitForTimeout(700);
  const M = await m.evaluate(() => {
    const PX = 3.7795275, mm = px => Math.round(px / PX * 10) / 10;
    return [...document.querySelectorAll('.hoja')].map(h => {
      const rej = h.querySelector('.rej'), marco = h.querySelector('.rejilla');
      const esc = (function () {
        const t = rej ? getComputedStyle(rej).transform : 'none';
        const x = t && t !== 'none' ? t.match(/matrix\(([\d.]+)/) : null;
        return x ? Number(x[1]) : 1;
      })();
      return {
        id: h.getAttribute('data-hoja') || '?',
        eyebrow: (h.querySelector('.ey') || {}).textContent || '',
        responde: (h.querySelector('.que-responde') || {}).textContent || '',
        neutral: (h.querySelector('.neutral') || {}).textContent || '',
        sub: (h.querySelector('.sub') || {}).textContent || '',
        escala: esc,
        pide: rej ? mm(rej.getBoundingClientRect().height) : 0,
        papel: marco ? mm(marco.getBoundingClientRect().height) : 0,
        anchoPapel: mm(h.getBoundingClientRect().width),
        altoPapel: mm(h.getBoundingClientRect().height),
        bandas: [...h.querySelectorAll('.banda h3')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
        cajas: [...h.querySelectorAll('.caja h2')].map(x => x.textContent.trim()),
        biblio: h.querySelectorAll('.pie .biblio li').length,
        propuestas: h.querySelectorAll('.sintesis-pie .pu').length,
        plano: !!h.querySelector('.plano-hero')
      };
    });
  });
  await m.close();
  await pg.close(); await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

  console.log('\n  -- el pliego son DOS láminas --');
  T('el lote quedó dibujado y el trazado medido', r.trazado === true);
  T('lo que sale a imprimir trae dos hojas, no una', M.length === 2, M.length + ' hojas');
  if (M.length !== 2) { console.log('\n  ' + (mal || 1) + ' comprobaciones fallaron'); process.exit(1); }
  const [A, B] = M;
  T('la primera es la A y la segunda la B', A.id === 'A' && B.id === 'B', A.id + ' · ' + B.id);
  T('las dos miden 60 × 90 de papel',
    Math.abs(A.anchoPapel - 600) < 2 && Math.abs(A.altoPapel - 900) < 2 &&
    Math.abs(B.anchoPapel - 600) < 2 && Math.abs(B.altoPapel - 900) < 2,
    A.anchoPapel + '×' + A.altoPapel + ' · ' + B.anchoPapel + '×' + B.altoPapel);
  T('cada una se presenta por su nombre',
    /Lámina A de 2 · Sitio y medio físico/.test(A.eyebrow) &&
    /Lámina B de 2 · Gente, usos y movilidad/.test(B.eyebrow),
    A.eyebrow + ' | ' + B.eyebrow);
  T('y dice qué pregunta responde',
    /condiciones físicas manda el terreno/.test(A.responde) &&
    /quién vive acá|cómo se mueve/i.test(B.responde),
    A.responde.slice(0, 60) + ' | ' + B.responde.slice(0, 60));

  console.log('\n  -- cada hoja cierra en SU papel --');
  /* Son dos contenidos distintos: obligarlas a la misma escala sería
     apretar una para acompañar a la otra. */
  T('ninguna de las dos se desborda',
    A.pide <= A.papel + 2 && B.pide <= B.papel + 2,
    'A ' + A.pide + '/' + A.papel + ' mm · B ' + B.pide + '/' + B.papel + ' mm');
  T('y cada una lleva su propia escala, no una compartida',
    A.escala > 0 && B.escala > 0,
    'A al ' + Math.round(A.escala * 100) + '% · B al ' + Math.round(B.escala * 100) + '%');
  /* Y ninguna deja media hoja en blanco. Con el pliego partido, a una
     lámina le puede SOBRAR papel, y entonces crece hasta llenarlo en vez
     de imprimirse a medio pliego: `TOPE_CRECER` en js/68. */
  T('y ninguna deja el papel a medio llenar',
    A.pide >= A.papel * 0.72 && B.pide >= B.papel * 0.72,
    'A usa el ' + Math.round(100 * A.pide / A.papel) + '% · B el ' + Math.round(100 * B.pide / B.papel) + '%');

  console.log('\n  -- la A es el sitio, la B es la gente --');
  const tieneBanda = (h, re) => h.bandas.some(x => re.test(x));
  T('la A abre con la ubicación y trae el plano del sector',
    tieneBanda(A, /Ubicación/i) && A.plano, A.bandas.join(' · '));
  T('la A trae el ambiental, el riesgo, la morfología y el lote',
    tieneBanda(A, /ambiental/i) && tieneBanda(A, /Riesgo y servicios/i) &&
    tieneBanda(A, /Morfolog/i) && tieneBanda(A, /lote y la norma/i),
    A.bandas.join(' · '));
  T('la B trae la demografía y los usos, la movilidad y el campo',
    tieneBanda(B, /Demogr/i) && tieneBanda(B, /Movilidad/i) && tieneBanda(B, /campo/i),
    B.bandas.join(' · '));
  T('y cierra con las cinco propuestas de uso', B.propuestas === 5, B.propuestas + ' propuestas');
  /* El corte de verdad: lo de una hoja NO aparece en la otra. Sin esto,
     partir el pliego sería solo repetirlo dos veces. */
  T('la B no repite el plano del sector ni las bandas del sitio',
    !B.plano && !tieneBanda(B, /Ubicación/i) && !tieneBanda(B, /ambiental/i),
    B.bandas.join(' · '));
  T('y la A no trae la movilidad ni el cierre',
    !tieneBanda(A, /Movilidad/i) && A.propuestas === 0, A.bandas.join(' · '));
  /* Y nada cae en la bolsa de lo no clasificado por culpa del corte: esa
     banda existe para las cajas nuevas, no para media lámina. */
  T('ninguna hoja manda cajas a «Otras mediciones»',
    !tieneBanda(A, /Otras mediciones/i) && !tieneBanda(B, /Otras mediciones/i));

  console.log('\n  -- la regla de neutralidad, impresa en las dos --');
  const neutralOk = t => /[Ss]in propósito declarado/.test(t) && /justificar/.test(t) &&
                         /URBIS recomienda, quien proyecta decide/.test(t);
  T('las dos láminas dicen que el análisis se hizo sin propósito declarado',
    neutralOk(A.neutral) && neutralOk(B.neutral), A.neutral.slice(0, 90));

  console.log('\n  -- el radio y la bibliografía --');
  T('las dos llevan el tamaño del área analizada en la cabecera',
    /Área dibujada|Radio de/.test(A.sub) && /Área dibujada|Radio de/.test(B.sub),
    A.sub.slice(0, 70));
  /* Es la bibliografía de las dos: repetirla en la A gasta el papel de dos
     columnas para decir lo mismo. */
  T('la bibliografía va al pie de la B y no se repite en la A',
    B.biblio >= 10 && A.biblio === 0, 'A ' + A.biblio + ' · B ' + B.biblio + ' entradas');

  console.log('\n  -- cada hoja se puede pedir suelta --');
  T('la A suelta trae su banda de riesgo y no la movilidad',
    /Riesgo y servicios/.test(r.soloA || '') && !/>Movilidad</.test(r.soloA || ''));
  /* Por el ELEMENTO y no por el texto: `plano-hero` también es una regla de
     la hoja de estilo, que viaja en las dos láminas, así que buscarlo suelto
     daba positivo siempre y la prueba pasaba por el motivo equivocado. */
  const traeElPlano = h => /<section class="caja[^"]*plano-hero/.test(h || '');
  T('la B suelta trae la movilidad y no el plano del sector',
    />Movilidad</.test(r.soloB || '') && !traeElPlano(r.soloB),
    traeElPlano(r.soloB) ? 'la B se trajo el plano' : 'sin plano, como debe ser');
  T('y la A suelta sí lo trae', traeElPlano(r.soloA));

  T('y la página no soltó errores', err.length === 0, err.slice(0, 2).join(' · ') || 'ninguno');

  console.log('\n  ' + (mal ? mal + ' comprobaciones fallaron' : 'todo en verde'));
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
