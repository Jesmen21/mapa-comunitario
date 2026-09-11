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
                 /* 38 + 44 + 3 + 10 = 95, no 100, A PROPÓSITO: es lo que
                    dispara el quinto chequeo de coherencia y permite medir
                    que un fallo se IMPRIME en vez de corregirse solo. */
                 { id: 'suelo', etq: 'Suelo desnudo', color: '#a16207', pct: 10, m2: 3500, fiable: false }] });
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
    /* La A suelta se pide CON clima: la caja del clima es la que prueba que
       un dato de ciudad no se rotula como del sector, y en este banco no hay
       servidor de clima al que consultarle. Se inyecta por opciones, que es
       para lo que `laminaA` las acepta. */
    o.soloA = R.laminaA({ hoja: 'A',
      clima: { temperatura: { media: 27.4, max: 33, min: 21 }, lluvia: { anual: 1180 }, viento: {} } });
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
        escalas: [...h.querySelectorAll('.caja')].map(c => ({
          t: ((c.querySelector('h2') || {}).textContent || '').trim(),
          e: c.getAttribute('data-escala') || '',
          rotulo: ((c.querySelector('h2 .escala-dato') || {}).textContent || '').trim() })),
        coherencia: (function () {
          const c = [...h.querySelectorAll('.caja')].filter(x =>
            /Coherencia de las cifras/.test((x.querySelector('h2') || {}).textContent || ''))[0];
          if (!c) return null;
          return { lee: (c.querySelector('.lee') || {}).textContent || '',
                   filas: [...c.querySelectorAll('.coh li')].map(li => ({
                     estado: (li.className.match(/coh-([a-z-]+)/) || [0, ''])[1],
                     texto: li.textContent.replace(/\s+/g, ' ').trim(),
                     rojo: getComputedStyle(li).color })) };
        })(),
        /* Las cinco escalas anidadas: cuántos marcos, cómo se rotulan, y
           cuáles van a trazos. Los cuatro de fuera TIENEN que ir a trazos:
           son esquemáticos, no son los límites de nadie. */
        escalera: (function () {
          const c = [...h.querySelectorAll('.caja')].filter(x =>
            /Dónde queda, escala por escala/.test((x.querySelector('h2') || {}).textContent || ''))[0];
          if (!c) return null;
          const svg = c.querySelector('.escalera svg');
          const marcos = svg ? [...svg.querySelectorAll('g')] : [];
          return {
            marcos: marcos.length,
            rotulos: marcos.map(g => ((g.querySelector('text') || {}).textContent || '').trim()),
            aTrazos: marcos.filter(g => {
              const r = g.querySelector('rect');
              return r && r.getAttribute('stroke-dasharray');
            }).length,
            /* el último lleva el trazo REAL del área analizada: polígono o
               círculo, no un contorno genérico */
            ultimoReal: !!(marcos.length && marcos[marcos.length - 1].querySelector('path, circle')),
            anchoMm: svg ? mm(svg.getBoundingClientRect().width) : 0,
            altoMm: svg ? mm(svg.getBoundingClientRect().height) : 0,
            texto: c.textContent.replace(/\s+/g, ' ').trim()
          };
        })(),
        /* La tabla de los tres radios: sus columnas y sus filas. */
        radios: (function () {
          const t = h.querySelector('table.rad');
          if (!t) return null;
          return {
            columnas: [...t.querySelectorAll('th')].map(x => x.textContent.trim()),
            filas: [...t.querySelectorAll('tr')].slice(1).map(tr =>
              [...tr.querySelectorAll('td')].map(x => x.textContent.trim()))
          };
        })(),
        /* Los dos paneles nuevos del lote: lo que miden y lo que declaran
           que NO pudieron medir. */
        paneles: (function () {
          const dame = re => {
            const c = [...h.querySelectorAll('.caja')].filter(x =>
              re.test((x.querySelector('h2') || {}).textContent || ''))[0];
            if (!c) return null;
            return {
              texto: c.textContent.replace(/\s+/g, ' ').trim(),
              kpis: [...c.querySelectorAll('.kpis .k')].map(x => ({
                v: ((x.querySelector('b') || {}).textContent || '').trim(),
                r: ((x.querySelector('small') || {}).textContent || '').trim() })),
              vacios: [...c.querySelectorAll('.vacio-tag')].map(x => x.textContent.trim()),
              falta: [...c.querySelectorAll('.vacio-falta')].map(x => x.textContent.replace(/\s+/g, ' ').trim())
            };
          };
          return { potencial: dame(/Potencial edificatorio/), suelo: dame(/Suelo disponible real/) };
        })(),
        biblio: h.querySelectorAll('.pie .biblio li').length,
        propuestas: h.querySelectorAll('.sintesis-pie .pu').length,
        plano: !!h.querySelector('.plano-hero')
      };
    });
  });
  await m.close();
  await pg.close(); await b.close();
  /* Las dos láminas, guardadas: cuando una comprobación de diagramación
     falla, mirarlas con el navegador dice en un minuto lo que adivinar no
     dice en media hora. */
  try {
    const fs2 = require('fs');
    fs2.writeFileSync(E.TRABAJO + 'lamina-dos.html', r.doc || '', 'utf8');
    fs2.writeFileSync(E.TRABAJO + 'lamina-solo-a.html', r.soloA || '', 'utf8');
    fs2.writeFileSync(E.TRABAJO + 'lamina-solo-b.html', r.soloB || '', 'utf8');
  } catch (e) {}

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

  console.log('\n  -- cada cifra dice a qué escala está medida (v854) --');
  const todas = A.escalas.concat(B.escalas);
  const sinDeclarar = todas.filter(x => x.e === 'sin-declarar' || /sin declarar/i.test(x.rotulo));
  T('todas las cajas de las dos láminas declaran su escala', todas.length > 20 && sinDeclarar.length === 0,
    sinDeclarar.length ? 'sin declarar: ' + sinDeclarar.map(x => x.t.replace(/\s+\S+$/, '')).join(' · ')
                       : todas.length + ' cajas, todas rotuladas');
  const CONOCIDAS = ['predio', 'sector', 'comuna', 'ciudad', 'municipio', 'departamento'];
  T('y usan escalas de la lista, no inventadas', todas.every(x => CONOCIDAS.indexOf(x.e) >= 0),
    [...new Set(todas.map(x => x.e))].join(' · '));
  /* Lo que importa de verdad: que lo que NO es del sector no se lea como si
     lo fuera. El clima sale de una celda de decenas de kilómetros y la
     zonificación sísmica va por municipio. */
  const escalaDe = t => (todas.filter(x => new RegExp('^' + t).test(x.t))[0] || {}).e || 'no está';
  T('y lo medido sobre el lote va como PREDIO, no como sector',
    escalaDe('El lote a intervenir') === 'predio', escalaDe('El lote a intervenir'));
  T('mientras un mapa del área analizada va como SECTOR',
    escalaDe('Cobertura del suelo') === 'sector', escalaDe('Cobertura del suelo'));
  /* La prueba de fuego de la regla: el clima NO es del sector. Sale de una
     celda de reanálisis de decenas de kilómetros, y puesto al lado del área
     del lote se lee como si fuera de ahí. En la A suelta, que se pide con
     clima inyectado porque este banco no tiene servidor de clima. */
  const escalaEn = (h, t) => {
    const re = new RegExp('data-escala="([a-z-]+)"[^>]*>\\s*<h2>' + t + '<');
    const m = String(h || '').match(re);
    return m ? m[1] : 'no está';
  };
  T('y el clima, que es de una celda que cubre media ciudad, va como CIUDAD',
    escalaEn(r.soloA, 'El clima') === 'ciudad', escalaEn(r.soloA, 'El clima'));
  T('la lámina distingue al menos tres escalas, no rotula todo igual',
    new Set(todas.map(x => x.e)).size >= 2 && new Set(todas.map(x => x.e)).has('predio'),
    [...new Set(todas.map(x => x.e))].join(' · '));

  console.log('\n  -- los siete chequeos de coherencia, impresos --');
  const CO = B.coherencia;
  T('el panel de coherencia está, y en la lámina B', !!CO && !A.coherencia);
  if (CO) {
    T('trae los siete chequeos', CO.filas.length === 7, CO.filas.length + ' chequeos');
    /* El que se puede correr y FALLA con este sector: la cobertura del suelo
       del fixture suma 95 y no 100. Tiene que salir impreso y en rojo. */
    const falla = CO.filas.filter(f => f.estado === 'falla');
    T('el chequeo que falla se imprime, no se corrige en silencio',
      falla.length >= 1 && /suman 100/.test(falla.map(f => f.texto).join(' ')),
      falla.map(f => f.texto.slice(0, 70)).join(' | ') || 'ninguno marcado como fallo');
    T('y dice la cifra real que encontró, no la que debería ser',
      falla.some(f => /95/.test(f.texto)), falla.map(f => f.texto.slice(0, 90)).join(' | '));
    T('en rojo, para que se vea de lejos',
      falla.every(f => /rgb\(180, 35, 24\)/.test(f.rojo)), falla.map(f => f.rojo).join(' · '));
    T('y la cabecera del panel avisa de cuántos fallan',
      /falla|fallan/.test(CO.lee), CO.lee.slice(0, 90));
    /* Los que no se pueden correr no se dan por buenos: dicen por qué y
       nombran la fuente que haría falta. Es la regla de los vacíos
       declarados, aplicada a los chequeos. */
    const sinDato = CO.filas.filter(f => f.estado === 'sin-dato');
    T('los que no se pueden correr lo dicen y nombran qué haría falta',
      sinDato.length >= 3 && sinDato.every(f => /haría falta|no se está leyendo|no consulta|por ciudad/i.test(f.texto)),
      sinDato.length + ' sin dato');
    T('y ninguno se presenta como aprobado sin haberse corrido',
      CO.filas.filter(f => f.estado === 'pasa').every(f => !/sin dato|haría falta/i.test(f.texto)));
  }

  console.log('\n  -- dónde queda, escala por escala --');
  /* Un jurado que no conoce la ciudad no sabe si el sector que mira es el
     centro o un borde. La cadena de cinco escalas se lo dice de un vistazo,
     y a la vez tiene que confesar que los cuatro marcos de fuera no son
     los límites reales de nada: este módulo no los descarga. */
  const EL = A.escalera;
  T('la cadena de escalas está, y en la lámina A', !!EL && !B.escalera);
  if (EL) {
    T('son cinco marcos: país, departamento, municipio, comuna, sector',
      EL.marcos === 5, EL.marcos + ' marcos');
    T('y cada uno va rotulado con su escala',
      ['País', 'Departamento', 'Municipio', 'Comuna', 'Sector']
        .every((x, i) => EL.rotulos[i] === x), EL.rotulos.join(' › '));
    T('los cuatro de fuera van a trazos, porque son esquemáticos',
      EL.aTrazos === 4, EL.aTrazos + ' a trazos de ' + EL.marcos);
    T('y el último lleva el trazo real del área analizada',
      EL.ultimoReal === true);
    /* La advertencia no es un detalle de estilo: pintar un contorno
       inventado sin decirlo es presentar una suposición como un dato, que
       es justo lo que el pliego prohíbe. */
    T('la hoja declara que los cuatro marcos ubican y no miden',
      /esquemáticos/.test(EL.texto) && /ubican, no miden/.test(EL.texto) &&
      /no descarga los límites/.test(EL.texto), EL.texto.slice(-170));
    T('y nombra los cinco niveles de verdad, con el geocodificador',
      /Colombia/.test(EL.texto) && /Norte de Santander|Santander/.test(EL.texto),
      (EL.texto.match(/[^.]*›[^.]*/) || [''])[0].slice(0, 110));
    T('el dibujo ocupa papel de verdad, no un icono',
      EL.anchoMm >= 45 && EL.altoMm >= 8, EL.anchoMm + ' × ' + EL.altoMm + ' mm');
  }

  console.log('\n  -- los tres radios cuentan EQUIPAMIENTOS, no solo usos --');
  /* Doscientos usos y ningún colegio no es un radio servido: usos y
     equipamientos son cuentas distintas y la tabla tiene que separarlas. */
  const RD = A.radios;
  T('la tabla de radios está', !!RD, RD ? RD.filas.length + ' filas' : 'no está');
  if (RD) {
    T('y trae su columna de equipamientos, aparte de la de usos',
      RD.columnas.indexOf('Equipamientos') > RD.columnas.indexOf('Usos') &&
      RD.columnas.indexOf('Usos') >= 0, RD.columnas.join(' | '));
    T('son los tres radios, con su cuenta cada uno',
      RD.filas.length === 3 && RD.filas.every(f => /^\d+$/.test(f[2])),
      RD.filas.map(f => f[0] + ': ' + f[1] + ' usos, ' + f[2] + ' eq').join(' · '));
    /* Y no es la misma cifra con otro nombre: el equipamiento es un
       subconjunto, así que nunca puede pasar del total de usos. */
    T('el equipamiento nunca pasa del total de usos del mismo radio',
      RD.filas.every(f => Number(f[2]) <= Number(f[1])),
      RD.filas.map(f => f[2] + '/' + f[1]).join(' · '));
  }

  console.log('\n  -- potencial edificatorio y suelo disponible --');
  const PT = (A.paneles || {}).potencial, SU = (A.paneles || {}).suelo;
  T('los dos paneles están, y en la lámina A',
    !!PT && !!SU && !(B.paneles || {}).potencial && !(B.paneles || {}).suelo);
  if (PT) {
    T('el potencial mide lo construido: media y el más alto',
      PT.kpis.length >= 2 && /pisos de media/.test(PT.texto) && /el más alto/.test(PT.texto),
      PT.kpis.map(x => x.v + ' ' + x.r).join(' · '));
    /* Y las dos cifras son NÚMEROS. Una raya en el sitio de la media es el
       fallo silencioso de este panel: el dato de OpenStreetMap llega
       repartido en cajones (`niveles`) y no trae media hecha, así que hay
       que calcularla. Una raya no se ve como error, se ve como «no hay». */
    T('y las dos son cifras, no una raya',
      PT.kpis.slice(0, 2).every(x => /^[\d.,]+$/.test(x.v)),
      PT.kpis.map(x => x.v + ' ' + x.r).join(' · '));
    /* El cajón de arriba de OpenStreetMap es «cuatro o más», así que un
       edificio de diez suma cuatro: la media que sale de ahí es un piso,
       no una media. Se da, y se dice que es un mínimo. */
    T('la media salida de los cajones se declara como mínimo',
      /pisos de media, al menos/.test(PT.texto) &&
      /agrupa todo lo de cuatro pisos o más/.test(PT.texto),
      (PT.kpis[0] || {}).r);
    /* Lo que NO se puede decir sin el POT no se estima: se declara. */
    T('y declara que la altura permitida no la tiene',
      PT.vacios.some(x => /Altura permitida: sin dato oficial/.test(x)), PT.vacios.join(' | '));
    T('nombrando la ficha normativa del POT como lo que haría falta',
      PT.falta.some(x => /ficha normativa del POT/.test(x) && /curaduría|planeación/.test(x)),
      PT.falta.join(' | ').slice(0, 130));
    /* La brecha medida sí se puede dar, y se da por lo que es: una cota
       por abajo, no el potencial normativo. */
    T('lo que sí da es una cota por abajo, dicha como tal',
      /cota por\s*abajo/.test(PT.texto) && /el propio sector demuestra que cabe/.test(PT.texto),
      PT.texto.slice(-120));
  }
  if (SU) {
    T('el suelo disponible parte de lo sin construir y descuenta el agua',
      /Suelo sin construir/.test(SU.texto) && /Menos la superficie de agua/.test(SU.texto),
      SU.kpis.map(x => x.v + ' ' + x.r).join(' · '));
    /* El salto de «sin construir» a «urbanizable» es el error caro de este
       panel: se cuenta lo vacío desde el satélite y se lee como suelo donde
       se puede construir. La cifra se rotula por lo que es y la hoja niega
       el salto con todas las letras. */
    T('y no lo llama urbanizable: ni en el rótulo de la cifra ni en el texto',
      SU.kpis.every(x => !/urbanizable/i.test(x.r)) &&
      /No es suelo urbanizable/.test(SU.texto) &&
      /queda por mirar en campo/.test(SU.texto),
      SU.kpis.map(x => x.v + ' ' + x.r).join(' · '));
    /* Los dos descuentos que faltan son los que cambiarían la cifra, así
       que van dichos uno por uno con su fuente. */
    T('dice cuáles son los dos descuentos que NO pudo hacer',
      SU.vacios.some(x => /NO se pudieron hacer/.test(x)) &&
      SU.falta.some(x => /ronda hídrica/i.test(x)) &&
      SU.falta.some(x => /pendiente/i.test(x) && /amenaza/i.test(x)),
      SU.falta.map(x => x.slice(0, 40)).join(' | '));
    T('y por qué el agua vista del satélite no es la ronda',
      /es suelo seco con restricción/.test(SU.texto), SU.falta.join(' ').slice(0, 140));
  }

  T('y la página no soltó errores', err.length === 0, err.slice(0, 2).join(' · ') || 'ninguno');

  console.log('\n  ' + (mal ? mal + ' comprobaciones fallaron' : 'todo en verde'));
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
