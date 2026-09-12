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
/* Con `center` además de `geometry`: la consulta de usos pide las vías con
   `out center` y de ahí saca el motor los corredores arteriales y su
   distancia al lote. Sin el centro, un sector lleno de avenidas con nombre
   se analiza como si no tuviera ninguna, y la banda de movilidad queda sin
   una sola vía que nombrar. */
/* Las etiquetas que el motor LEE de una vía y que este sector no traía:
   `oneway`, `width` y `sidewalk`. Sin ellas tres caminos del motor no se
   ejecutaban nunca —el porcentaje en un solo sentido salía 0 siempre, el
   ancho se sacaba de carriles siempre, y del andén no se sabía nada nunca—,
   así que la lámina imprimía esas tres cosas sin que ninguna prueba las
   mirara. Se reparten por jerarquía, como en un barrio de verdad: las
   troncales y principales traen ancho medido y andén; las locales van en un
   solo sentido y muchas sin andén registrado. */
const ETQ_VIA = (clase, i) => {
  const t = { highway: clase, lanes: clase === 'trunk' ? '4' : clase === 'primary' ? '3' : '2' };
  if (clase === 'trunk' || clase === 'primary') { t.width = clase === 'trunk' ? '18' : '12'; t.sidewalk = 'both'; }
  else if (clase === 'secondary') { t.sidewalk = 'both'; }
  else if (clase === 'residential') { if (i % 2) t.oneway = 'yes'; if (i % 3 === 0) t.sidewalk = 'no'; }
  return t;
};
let nVia = 0;
const via = (nombre, clase, pts) => ({ type: 'way', id: gid++,
  tags: Object.assign({ name: nombre }, ETQ_VIA(clase, nVia++)),
  center: { lat: pts[Math.floor(pts.length / 2)].lat, lon: pts[Math.floor(pts.length / 2)].lng },
  geometry: pts.map(p => ({ lat: p.lat, lon: p.lng })) });
const edif = (dx, dy, w2, h2, pisos) => ({ type: 'way', id: gid++,
  tags: { building: 'yes', 'building:levels': String(pisos) },
  geometry: [P(dx, dy), P(dx + w2, dy), P(dx + w2, dy + h2), P(dx, dy + h2), P(dx, dy)]
    .map(p => ({ lat: p.lat, lon: p.lng })) });
/* Las calles de la retícula COMPARTEN el vértice donde se cruzan. El motor
   cuenta una intersección donde dos vías tocan el mismo nodo, y Overpass solo
   lista los vértices propios de cada vía: dos líneas que se cruzan en el
   plano pero no comparten vértice no son un cruce para nadie. Sin esto el
   sector de prueba salía con cuatro intersecciones y 5.766 m de tramo medio
   —una supermanzana de casi seis kilómetros de lado—, así que la continuidad
   del tejido se estaba midiendo sobre una malla que no existe.
   Las EO van cada 200 m y las NS cada 100: 7 × 13 nodos compartidos. */
const EO = [-600, -400, -200, 0, 200, 400, 600];      // y de las horizontales
const NS = Array.from({ length: 13 }, (_, i) => -600 + i * 100);  // x de las verticales
const horizontal = y => NS.map(x => P(x, y));
const vertical = x => EO.map(y => P(x, y));
const geo = [
  /* La troncal va en diagonal y por eso NO comparte vértices con la retícula:
     es la vía que la atraviesa, y así se comporta en el conteo. */
  via('Autopista Nacional', 'trunk', [P(-600, -500), P(-100, 0), P(600, 500)]),
  via('Avenida 1', 'primary', horizontal(200)),
  via('Avenida 3', 'primary', vertical(-300)),
  via('Calle 8', 'secondary', horizontal(-200)),
  via('Calle 12', 'secondary', vertical(200)),
  via('Carrera 5', 'tertiary', horizontal(400)),
  via('Carrera 9', 'tertiary', horizontal(-400))
].concat(
  Array.from({ length: 12 }, (_, i) => via('Calle interior ' + i, 'residential',
    vertical(-600 + i * 100))),
  Array.from({ length: 6 }, (_, i) => via('Sendero ' + i, 'footway',
    [P(-400, -500 + i * 180), P(400, -500 + i * 180)])),
  Array.from({ length: 30 }, (_, i) => edif(-560 + (i % 10) * 115,
    -400 + Math.floor(i / 10) * 220, 60, 90, 3 + (i % 5)))
);

/* Lo que este sector necesita para tener CIFRAS SUELTAS: un parque con
   forma —el espacio público efectivo se mide sobre el polígono— y una pieza
   de infraestructura de servicios. Son las dos cajas de puras cifras que la
   lámina educativa convierte en baldosas; sin ellas la regla no tendría con
   qué probarse en este sector, que es de comercio y calles.

   UNA sola pieza, y a propósito, desde la v874: con dos, la hoja imprimía
   siempre «2 piezas de servicios registradas» y la rama del SINGULAR no se
   ejercitaba en ninguna prueba — que es como llegó a producción «1 piezas de
   servicios registradas». La lista de varias piezas, con su orden por
   distancia y el tanque de agua, la cubre `tmasanalisis`, que trae tres. */
geo.push({ type: 'way', id: gid++, tags: { leisure: 'park', name: 'Parque La Playa' },
  geometry: [P(-250, -150), P(-90, -150), P(-90, -30), P(-250, -30), P(-250, -150)]
    .map(p => ({ lat: p.lat, lon: p.lng })) });
/* Las RUTAS de transporte, que el sector no traía. La consulta de usos las
   pide —`rel(bn.paradas)["route"…]`, las relaciones que recogen en alguna
   parada del área— y el motor las cuenta deduplicando ida y vuelta, pero sin
   una sola relación en el sector de prueba ese camino no se ejecutaba nunca
   y `movilidad.rutas` salía vacío en todas las versiones. Van tres: dos
   distintas y la vuelta de una, para que la deduplicación se ejercite. */
usos.push({ type: 'relation', id: 7001,
  tags: { route: 'bus', ref: '12', name: 'Ruta 12 · Centro–La Playa', operator: 'Cootransunidos' } });
usos.push({ type: 'relation', id: 7002,
  tags: { route: 'bus', ref: '7', name: 'Ruta 7 · Atalaya–Centro', operator: 'Cootransunidos' } });
usos.push({ type: 'relation', id: 7003,
  tags: { route: 'bus', ref: '12', name: 'Ruta 12 · La Playa–Centro (vuelta)' } });
usos.push({ type: 'node', id: 3001, lat: C.lat + 0.002, lon: C.lng - 0.0015,
  tags: { name: 'Subestación La Playa', power: 'substation' } });

/* Los usos de ALTO IMPACTO, que el sector de prueba no traía y un corredor
   de Cúcuta trae de sobra. Entraron en la v874 por el motivo de siempre: sin
   ellos, «ningún hito es un motel» se cumple porque no hay moteles, que es el
   peor verde que hay — parece una comprobación y no comprueba nada.

   Los cinco llevan NOMBRE PROPIO a propósito: `nombrePropio` es el primer
   filtro de la lista de hitos, así que un motel anónimo tampoco habría
   ejercitado nada. Con nombre, antes de la v874 los cinco competían por los
   seis puestos de la lista, y tres la ganaban. */
usos.push({ type: 'node', id: 3101, lat: C.lat + 0.0012, lon: C.lng + 0.0011,
  tags: { name: 'Motel Luna Azul', tourism: 'motel' } });
usos.push({ type: 'node', id: 3102, lat: C.lat - 0.0013, lon: C.lng + 0.0014,
  tags: { name: 'Bar La Esquina', amenity: 'bar' } });
usos.push({ type: 'node', id: 3103, lat: C.lat + 0.0016, lon: C.lng - 0.0012,
  tags: { name: 'Funeraria Los Olivos', shop: 'funeral_directors' } });
usos.push({ type: 'node', id: 3104, lat: C.lat - 0.0011, lon: C.lng - 0.0016,
  tags: { name: 'Estación Terpel La Playa', amenity: 'fuel' } });
usos.push({ type: 'node', id: 3105, lat: C.lat + 0.0019, lon: C.lng + 0.0018,
  tags: { name: 'Bodega Distribuidora del Norte', building: 'warehouse', landuse: 'industrial' } });

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
      /* La consulta de usos también trae las VÍAS, con su centro: de ahí
         salen los corredores arteriales, las paradas y el flujo. Sirviéndole
         solo los POI, el sector se analizaba como si no tuviera una sola
         avenida con nombre y la banda de movilidad no tenía nada que nombrar. */
      body: JSON.stringify({ elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos.concat(geo) }) });
  });
  /* El censo, con el doble compartido: contesta SEXO y los veintiún tramos de
     edad además de la población, que es lo que la consulta pide de verdad.
     Con `{TOTAL, N}` a secas —lo que había acá— `demografia()` devolvía null y
     el panel «Quién vive acá» no se dibujaba: la pirámide de la lámina B
     llevaba versiones sin medirse. */
  await E.rutaDane(ctx);
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
        /* Todo lo que la hoja dice, en una sola tira. Las comprobaciones de
           redacción —la concordancia, un plural donde va un singular— son
           sobre la hoja entera y no sobre un panel. */
        texto: h.textContent.replace(/\s+/g, ' ').trim(),
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
        /* Los once cruces del cierre, con su valor y su lectura. Se leen para
           poder comprobar que ninguno declara ausente algo que otra caja de
           la MISMA hoja está imprimiendo. */
        /* Los HITOS impresos, con la categoría que el motor les puso. Se leen
           por separado del texto porque la comprobación es sobre CADA UNO:
           «ningún hito es de alto impacto» no se puede mirar en un párrafo.

           Y se buscan DENTRO de su caja, no en la hoja: la clase `.hit` la
           comparten los hitos y los núcleos de comercio de «Dónde está la
           calle comercial», así que `querySelectorAll('.hit')` a secas
           devolvía las dos listas mezcladas — y un núcleo llamado como un
           motel habría hecho fallar la comprobación de los hitos. */
        hitos: (function () {
          const c = [...h.querySelectorAll('.caja')].find(x => {
            const t = x.querySelector('h2');
            return t && /^Hitos y nodos$/.test(t.textContent.trim());
          });
          return c ? [...c.querySelectorAll('.hit')].map(x => ({
            nombre: ((x.querySelector('span') || {}).textContent || '').trim(),
            cat: ((x.querySelector('u') || {}).textContent || '').trim() })) : [];
        })(),
        cruces: [...h.querySelectorAll('.cruces li, .cruce')].map(x =>
          x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
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
              falta: [...c.querySelectorAll('.vacio-falta')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
              columnas: [...c.querySelectorAll('table.rad th')].map(x => x.textContent.trim()),
              filas: [...c.querySelectorAll('table.rad tr')].slice(1)
                .map(tr => [...tr.querySelectorAll('td')].map(x => x.textContent.trim())),
              banda: (c.closest('.banda') || {}).className || '',
              barras: [...c.querySelectorAll('.barras > .b')].map(x =>
                x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
              caras: [...c.querySelectorAll('.manzanas svg path')].length,
              cuadros: [...c.querySelectorAll('.grano svg g')].map(g => {
                const r = g.querySelector('rect'), t = [...g.querySelectorAll('text')];
                return { lado: Number(r.getAttribute('width')),
                         metros: Number((t[0] || {}).textContent.replace(/[^\d]/g, '')) || 0,
                         etq: ((t[1] || {}).textContent || '').trim(),
                         trazos: !!r.getAttribute('stroke-dasharray') };
              })
            };
          };
          return { potencial: dame(/Potencial edificatorio/), suelo: dame(/Suelo disponible real/),
                   quien: dame(/Quién vive acá/),
                   censo: dame(/Lo que el censo trae además/),
                   tejido: dame(/Continuidad del tejido/),
                   grano: dame(/El grano: manzana y predio/),
                   ciudad: dame(/El sector dentro de la ciudad/),
                   fuera: dame(/Quién queda por fuera/),
                   mueve: dame(/Cómo se mueve el sector/) };
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

  console.log('\n  -- el sector, comparado con su ciudad --');
  /* «1.200 habitantes» no dice nada hasta que se sabe si eso es el 0,2 % o
     el 12 % de la ciudad. La comparación es obligatoria (§2.2) y va en la
     lámina B, que es la de la gente. */
  const CD = (B.paneles || {}).ciudad;
  T('el panel de comparación está, y en la lámina B', !!CD && !(A.paneles || {}).ciudad);
  if (CD) {
    T('dice qué parte de la ciudad vive en el sector',
      /% de .*vive acá|vive acá/.test(CD.kpis.map(x => x.r).join(' ')) &&
      CD.kpis.some(x => /%$/.test(x.v)),
      CD.kpis.map(x => x.v + ' ' + x.r).join(' · '));
    T('y nombra la ciudad y su población, con el año de la proyección',
      /Cúcuta/.test(CD.texto) && /proyectada a \d{4}/.test(CD.texto),
      (CD.texto.match(/Población de [^·]*/) || ['no lo dice'])[0].slice(0, 80));
    /* Las dos cifras del mismo año y de la misma serie: comparar un censo de
       2018 contra una proyección de hoy fabrica una diferencia que no
       existe, y es el error que esta caja tiene que evitar y decir. */
    T('y declara que las dos salen de la misma serie y del mismo año',
      /misma serie del DANE y del mismo año/.test(CD.texto), CD.texto.slice(-150));
    /* Lo que NO se puede comparar todavía va dicho, con la tabla que lo
       resolvería: es la diferencia entre «no se sabe» y «nadie fue a
       buscarlo». */
    T('y dice qué comparaciones todavía no puede hacer, con su fuente',
      CD.vacios.some(x => /todavía no se puede comparar/.test(x)) &&
      CD.falta.length >= 3 && CD.falta.every(x => /[Hh]aría falta/.test(x)),
      CD.falta.map(x => x.slice(0, 38)).join(' | '));
    T('entre ellas la estructura de edades y la densidad de la ciudad',
      /estructura de edades de la ciudad/i.test(CD.falta.join(' ')) &&
      /densidad de la ciudad/i.test(CD.falta.join(' ')));
  }
  /* Y la escala: es una cifra de MUNICIPIO impresa al lado de las del
     sector, que es exactamente el error que la tabla de escalas evita. */
  const escalaB = t => (B.escalas.filter(x => x.t === t)[0] || {}).e || 'no está';
  T('la comparación con la ciudad va rotulada como municipio',
    escalaB('El sector dentro de la ciudad') === 'municipio',
    escalaB('El sector dentro de la ciudad'));
  /* Y las otras dos no: son del sector. Si todo se rotulara igual, el
     rótulo no estaría diciendo nada. */
  T('y las otras dos de la lámina B siguen siendo del sector',
    escalaB('Quién queda por fuera') === 'sector' &&
    escalaB('Cómo se mueve el sector') === 'sector',
    escalaB('Quién queda por fuera') + ' · ' + escalaB('Cómo se mueve el sector'));

  console.log('\n  -- la cobertura, en personas y no en porcentaje de área --');
  /* «El 38 % del sector no tiene colegio a diez minutos» se mira y se pasa
     de página; «cuatrocientas personas no lo tienen» se discute. */
  const QF = (B.paneles || {}).fuera;
  T('el panel está, y en la lámina B', !!QF && !(A.paneles || {}).fuera);
  if (QF) {
    T('la tabla separa servidas de NO servidas',
      QF.columnas.indexOf('Servidas') >= 0 && QF.columnas.indexOf('NO servidas') >= 0 &&
      QF.columnas.indexOf('A pie') >= 0, QF.columnas.join(' | '));
    T('con una fila por equipamiento y su radio en minutos',
      QF.filas.length >= 3 && QF.filas.every(f => /\d+ min/.test(f[1])),
      QF.filas.slice(0, 3).map(f => f[0] + ' ' + f[1] + ': ' + f[2] + '/' + f[3]).join(' · '));
    /* Servidas más no servidas es la población del sector: si no suman, una
       de las dos columnas está midiendo otra cosa. */
    const num = x => Number(String(x).replace(/\./g, '').replace(/[^\d]/g, '')) || 0;
    const sumas = QF.filas.map(f => num(f[2]) + num(f[3]));
    T('y las dos columnas suman siempre la misma población',
      sumas.length >= 3 && sumas.every(x => Math.abs(x - sumas[0]) <= 2),
      [...new Set(sumas)].join(' · '));
    T('la peor cubierta se nombra con su cifra de personas',
      /La peor cubierta es/.test(QF.texto) && /personas<\/b> no la alcanzan|personas no la alcanzan/.test(QF.texto),
      (QF.texto.match(/La peor cubierta es[^.]*/) || [''])[0].slice(0, 110));
    /* El supuesto, dicho. Sin esta línea la cifra parece contada y no lo es:
       es la del sector repartida por igual sobre su superficie. */
    T('y el supuesto del reparto va dicho, no escondido',
      /reparte la población del sector por igual sobre su superficie/.test(QF.texto) &&
      /población por manzana/.test(QF.texto), QF.texto.slice(-170));
  }

  console.log('\n  -- la red de vías, con sus nombres --');
  /* Un plano de movilidad sin las vías nombradas no se puede discutir en una
     mesa: «la vía principal» no es una vía, es una categoría. */
  const MV = (B.paneles || {}).mueve;
  T('el panel está, y en la banda de movilidad de la lámina B',
    !!MV && /banda-movilidad/.test((MV || {}).banda || '') && !(A.paneles || {}).mueve,
    MV ? (MV.banda.match(/banda-[a-z]+/) || [''])[0] : 'no está');
  if (MV) {
    T('mide la red: kilómetros, densidad y cuánto va en un solo sentido',
      MV.kpis.length >= 3 && /km de vía/.test(MV.texto) &&
      /km por hectárea/.test(MV.texto) && /en un solo sentido/.test(MV.texto),
      MV.kpis.map(x => x.v + ' ' + x.r).join(' · '));
    T('y nombra las vías que estructuran el sector, con su jerarquía',
      MV.columnas.indexOf('Vía') >= 0 && MV.columnas.indexOf('Jerarquía') >= 0 &&
      MV.filas.length >= 2 && MV.filas.some(f => /Autopista|Avenida|Calle|Carrera/.test(f[0])),
      MV.filas.slice(0, 3).map(f => f.join(' · ')).join(' | '));
    /* Lo que el plano NO tiene, dicho por su nombre. El flujo es MODELADO y
       decirlo importa: un aforo y un modelo no se defienden igual. */
    T('declara que el recorrido, el aforo y el perfil acotado todavía no están',
      MV.falta.length >= 3 && /recorrido de las rutas/i.test(MV.falta.join(' ')) &&
      /aforo de hora pico/i.test(MV.falta.join(' ')) &&
      /perfil acotado|ancho de las vías/i.test(MV.falta.join(' ')),
      MV.falta.map(x => x.slice(0, 40)).join(' | '));
    /* Las rutas que paran en el sector, CON SU NOMBRE. La consulta de usos
       las pide y el informe en hojas ya las imprimía; esta lámina las
       declaraba faltantes hasta la v863. */
    T('nombra las rutas que paran en el sector',
      MV.columnas.indexOf('Ruta') >= 0 &&
      MV.filas.some(f => /Ruta 12|Ruta 7/.test(f.join(' '))),
      MV.filas.filter(f => /Ruta/.test(f.join(' '))).map(f => f.join(' · ')).join(' | ').slice(0, 120));
    /* Y la ida y la vuelta de una misma ruta cuentan como UNA: contarlas dos
       veces exageraría la oferta de transporte del sector. */
    T('y la ida y la vuelta de una misma ruta cuentan como una',
      (function () {
        const refs = MV.filas.map(f => f[0]).filter(x => /^\d+$/.test(x));
        return refs.length === new Set(refs).size && refs.length >= 2;
      })(),
      MV.filas.map(f => f[0]).filter(x => /^\d+$/.test(x)).join(' · '));
    /* Y la carencia YA NO dice que OpenStreetMap no sepa qué ruta para en
       cada parada, porque sí lo sabe: lo que falta es el recorrido —se pide
       sin geometría a propósito— y la frecuencia. */
    T('y no vuelve a decir que OSM no sabe qué ruta para en cada parada',
      !/no qué ruta para en cada una/.test(MV.texto) &&
      /sin.{0,3}geometría/.test(MV.falta.join(' ')) &&
      /cada cuánto pasan/.test(MV.falta.join(' ')),
      (MV.falta.filter(x => /recorrido de las rutas/.test(x))[0] || '').slice(0, 150));
    /* ── Y NO declara faltando lo que sí tiene ────────────────────────
       La v858 puso la isócrona por malla en la lista de lo que falta, y no
       faltaba: se calcula con Dijkstra sobre el grafo de calles desde el
       lote, 5/10/15 min, y se pintan los tramos que se alcanzan. Declarar
       ausente algo medido es peor que un dato de menos: en un módulo que se
       sostiene sobre sus declaraciones, enseña a desconfiar de las que sí
       son ciertas. Con el lote dibujado —que es el caso de esta prueba— la
       isócrona no puede aparecer entre las carencias. */
    T('y NO declara faltando la isócrona, que sí está medida',
      !/isócronas? por (la )?malla/i.test(MV.falta.join(' ')) &&
      !/se alcanza a pie se mide en línea recta/i.test(MV.texto),
      MV.falta.map(x => x.slice(0, 46)).join(' | '));
    /* Y dice cuál de las dos distancias es cuál, porque en esta lámina
       conviven: la del lote va por las calles, la cobertura del sector en
       línea recta. Leerlas como si fueran lo mismo es el error que el panel
       existe para evitar. */
    T('y distingue la distancia por calles de la de línea recta',
      /medido caminando por las calles/.test(MV.texto) &&
      /en línea recta/.test(MV.texto) && /200 m puede estar a 600 m de camino/.test(MV.texto),
      (MV.texto.match(/Ojo con las dos distancias[^.]*\./) || ['no lo distingue'])[0].slice(0, 120));
    /* El ancho tampoco se declara mal: sale de `width` cuando OpenStreetMap
       lo trae y de los carriles cuando no, y la hoja dice cuál de los dos
       usó y sobre qué parte de la red hay dato. */
    /* Tres etiquetas que el motor lee y que el sector de prueba no traía
       hasta la v862: `oneway`, `sidewalk` y `width`. Sin ellas la lámina
       imprimía «0 % en un solo sentido» y «del andén no se sabe en el 100 %»
       en todas las versiones, siempre, y ninguna prueba lo miraba. */
    T('el sentido único se mide de verdad, no sale 0 por no traer la etiqueta',
      (function () {
        const k = MV.kpis.filter(x => /un solo sentido/.test(x.r))[0];
        const v = k ? Number(String(k.v).replace('%', '').replace(',', '.')) : 0;
        return v > 0 && v < 100;
      })(),
      (MV.kpis.filter(x => /un solo sentido/.test(x.r))[0] || {}).v || 'no está');
    T('y del andén se sabe en parte de la red, no en ninguna',
      (function () {
        const m = MV.falta.join(' ').match(/andén no se sabe en el ([\d,]+) %/);
        const v = m ? Number(m[1].replace(',', '.')) : 100;
        return v > 0 && v < 100;
      })(),
      (MV.falta.join(' ').match(/andén no se sabe en el [\d,]+ %/) || ['sin dato de andén'])[0]);
    T('el ancho dice de dónde sale y qué parte de la red cubre',
      /(etiqueta de ancho de OpenStreetMap|contar carriles)/.test(MV.falta.join(' ')) &&
      /% de los metros de vía/.test(MV.falta.join(' ')),
      (MV.falta.filter(x => /ancho de acá sale/.test(x))[0] || 'no lo dice').slice(0, 130));
    T('y que el flujo que imprime está modelado, no contado',
      /está MODELADO|modelado/.test(MV.texto) && /no contado/.test(MV.texto),
      (MV.texto.match(/El aforo de hora pico[^.]*\./) || [''])[0].slice(0, 120));
  }

  console.log('\n  -- la continuidad del tejido --');
  /* Dos sectores con el mismo porcentaje construido pueden tener uno el
     triple de cruces que el otro, y eso no se ve en la foto: es lo que
     separa un barrio que se camina de uno que solo se atraviesa. */
  const TJ = (A.paneles || {}).tejido;
  T('el panel está, y en la lámina A', !!TJ && !(B.paneles || {}).tejido);
  if (TJ) {
    T('mide los cruces por km² y el tramo medio entre ellos',
      TJ.kpis.length >= 2 && /cruces por km²/.test(TJ.texto) && /m entre cruces/.test(TJ.texto),
      TJ.kpis.map(x => x.v + ' ' + x.r).join(' · '));
    /* Sin el umbral al lado, «87 cruces» no significa nada: una cifra sin
       su referencia no es un dato, es un número. */
    T('y la cifra va con su referencia, no suelta',
      /por debajo de <b>100<\/b>|por debajo de 100/.test(TJ.texto) &&
      /150/.test(TJ.texto) && /caminable/.test(TJ.texto),
      (TJ.texto.match(/La referencia:[^.]*/) || ['no hay referencia'])[0].slice(0, 120));
    T('y cierra en un juicio, no en el número',
      /trama fina|trama continua|trama gruesa|trama de supermanzana/.test(TJ.texto),
      (TJ.texto.match(/esto es una [^.]*/) || [''])[0].slice(0, 90));
    /* Y el límite de lo que se contó: un barrio a medio mapear sale con
       menos cruces de los que tiene, no con los que tiene. */
    /* Ningún porcentaje de esta caja puede pasar de 100. Suena obvio y no lo
       es: los fondos de saco y los cruces son conjuntos DISJUNTOS —el motor
       cuenta cruce el nodo que tocan dos vías y sin salida el que toca una
       sola—, así que dividir unos por otros daba «750 % de los cruces no
       tienen salida». En un sector normal habría salido un número creíble y
       nadie lo habría mirado dos veces. */
    const pcts = (TJ.texto.match(/(\d+(?:,\d+)?)\s*%/g) || [])
      .map(x => Number(x.replace('%', '').replace(',', '.').trim()));
    T('y ningún porcentaje suyo se pasa de 100',
      pcts.every(x => x <= 100), pcts.join(' % · ') + ' %');
    T('dice que lo contado depende de cuánto esté mapeado el barrio',
      /a medio mapear sale con menos cruces de los que tiene/.test(TJ.texto),
      TJ.texto.slice(-140));
  }

  console.log('\n  -- el grano: la manzana medida y el predio que no está --');
  const GR = (A.paneles || {}).grano;
  T('el panel está, y en la lámina A', !!GR && !(B.paneles || {}).grano);
  if (GR) {
    T('dibuja el módulo del sector contra dos referencias',
      GR.cuadros.length === 3 && /Este sector/.test(GR.cuadros.map(c => c.etq).join(' ')),
      GR.cuadros.map(c => c.etq + ' ' + c.metros + ' m').join(' · '));
    /* Lo único que hace honesta la comparación: los tres a la MISMA escala.
       Dibujarlos del mismo tamaño con la cifra al pie sería mentir sin
       escribir una palabra falsa, y un diagrama puede hacer eso. */
    const esc2 = GR.cuadros.filter(c => c.metros > 0)
      .map(c => c.lado / Math.sqrt(c.metros));
    T('y los tres van a la misma escala, no del mismo tamaño',
      esc2.length === 3 && esc2.every(x => Math.abs(x - esc2[0]) < 0.02) &&
      new Set(GR.cuadros.map(c => Math.round(c.lado))).size > 1,
      GR.cuadros.map(c => c.metros + ' m → ' + Math.round(c.lado * 10) / 10).join(' · '));
    T('el del sector va lleno y las dos referencias a trazos',
      GR.cuadros.filter(c => c.trazos).length === 2 && !GR.cuadros[0].trazos,
      GR.cuadros.map(c => c.etq + (c.trazos ? ' (trazos)' : ' (lleno)')).join(' · '));
    T('y la hoja dice por qué están a la misma escala',
      /MISMA escala/.test(GR.texto) && /mentir sin escribir/.test(GR.texto),
      GR.texto.slice(0, 0) + (GR.texto.match(/Los tres cuadrados[^.]*\./) || [''])[0].slice(0, 110));
    /* El predio NO está, y de eso depende quién puede construir qué: se
       declara, con el catastro nombrado, y se dice por qué una huella de
       edificio no es un lote. */
    T('el predio se declara sin dato, con el catastro nombrado',
      GR.vacios.some(x => /predio.*sin dato oficial/i.test(x)) &&
      /IGAC|catastro municipal/.test(GR.falta.join(' ')),
      GR.vacios.join(' | '));
    T('y explica por qué una huella de edificio no es un predio',
      /HUELLAS DE EDIFICIO/.test(GR.texto) && /no son predios/.test(GR.texto) &&
      /tres construcciones o ninguna/.test(GR.texto),
      (GR.falta.filter(x => /HUELLAS/.test(x))[0] || '').slice(0, 130));
    /* Hasta la v859 acá se comprobaba que la hoja dijera «la manzana se
       DEDUCE, no se delimita», que era la verdad entonces. La v860 la
       delimita, así que la comprobación se aprieta en vez de borrarse: la
       hoja tiene que decir CUÁL de las dos cosas hizo, y decirlo bien. Una
       caja que dijera «se cerraron» sin haber cerrado ninguna, o «se deduce»
       teniendo treinta cerradas, estaría mintiendo en direcciones opuestas y
       las dos importan. */
    /* Se mira la DECLARACIÓN de la caja —lo que promete al lector— y no el
       texto entero: la ficha de método describe las dos ramas a propósito
       («sin caras cerradas, el módulo se deduce del tramo medio»), y buscar
       ahí daría un falso positivo eterno. */
    const cerro = /manzanas no se dedujeron/.test(GR.texto);
    const dice = GR.falta.join(' ');
    T('la hoja dice cuál de las dos hizo, y coincide con lo que hay',
      cerro ? (GR.caras > 0 && /no es el lindero catastral/.test(dice) &&
               !/El módulo de arriba se deduce/.test(dice))
            : (GR.caras === 0 && /El módulo de arriba se deduce/.test(dice)),
      cerro ? 'cerró manzanas y lo dice · ' + GR.caras + ' dibujadas'
            : 'no pudo cerrar ninguna y lo dice');
  }
  /* Las dos son del sector, y van en la banda de morfología de la A. */
  T('las dos van en la banda de morfología',
    !!TJ && !!GR && /banda-forma/.test(TJ.banda) && /banda-forma/.test(GR.banda),
    [TJ, GR].filter(Boolean).map(x => (x.banda.match(/banda-[a-z]+/) || [''])[0]).join(' · '));

  console.log('\n  -- la manzana, cerrada y no deducida (v860) --');
  /* Hasta la v859 el tamaño de manzana se DEDUCÍA del tramo medio entre
     cruces y la hoja lo decía. Cerrando las caras del grafo de calles deja
     de ser una deducción: cada cara acotada por vías es una manzana, y se
     puede medir una por una y dibujarla. */
  if (GR) {
    T('el sector trae sus manzanas cerradas, con la cuenta',
      /Manzanas cerradas/.test(GR.texto) && /Área mediana/.test(GR.texto) &&
      /Área media/.test(GR.texto),
      (GR.texto.match(/Manzanas cerradas\s*\d+/) || ['no las trae'])[0]);
    /* Nueve manzanas tiene la retícula del sector de prueba: 7 líneas
       este-oeste por 13 norte-sur dejan 6 × 12 caras, menos las que el
       borde deja abiertas. Lo que importa es que sean VARIAS y que se
       dibujen, no el número exacto. */
    T('y las dibuja, una por una',
      GR.caras >= 4, GR.caras + ' caras dibujadas');
    T('la lectura dice que se cerraron, no que se dedujeron',
      /no se dedujeron/.test(GR.texto) && /se <b>cerraron<\/b>|se cerraron/.test(GR.texto) &&
      /recorriendo la malla/.test(GR.texto),
      (GR.texto.match(/Estas \d+ manzanas[^.]*\./) || [''])[0].slice(0, 110));
    /* Media y mediana separadas: si el sector tiene una manzana enorme, el
       promedio miente y la mediana no. Imprimir solo una de las dos es
       perder justo la información que las dos juntas dan. */
    T('y separa la media de la mediana, que es lo que dice si el sector es parejo',
      /media y la mediana separadas/.test(GR.texto),
      GR.texto.slice(-60));
    /* Y el aviso que impide confundirla con un lindero: la cara que dejan
       las vías se parece a una manzana catastral y no es lo mismo. */
    T('avisa de que la manzana cerrada no es el lindero catastral',
      GR.falta.some(x => /no es el lindero catastral/.test(x)) &&
      /falte una calle por mapear, dos manzanas salen como una/.test(GR.falta.join(' ')),
      (GR.falta.filter(x => /lindero/.test(x))[0] || 'no lo dice').slice(0, 140));
    /* Y el módulo comparado ya no sale del tramo medio: sale de la mediana
       medida, así que la frase «deducidos del tramo medio» tiene que haber
       desaparecido de esta hoja. */
    T('el módulo comparado sale ya de lo medido, no del tramo medio',
      !/deducidos del tramo medio/.test(GR.texto),
      (GR.texto.match(/mide del orden de[^.]*\./) || [''])[0].slice(0, 90));
  }

  console.log('\n  -- la pirámide, que hasta ahora no se dibujaba en ninguna prueba --');
  /* El censo de este sector llega por el doble compartido (`E.rutaDane`), que
     contesta SEXO y los veintiún tramos de edad además de la población. Con
     el mock de antes —`{TOTAL, N}` a secas— `demografia()` devolvía null y
     esta caja no se pintaba: la pirámide de la lámina B llevaba versiones
     entrando sin que nada la midiera. */
  const QV = (B.paneles || {}).quien;
  T('el panel de quién vive acá está, y en la lámina B', !!QV && !(A.paneles || {}).quien);
  if (QV) {
    T('separa el conteo del censo de la proyección a hoy',
      /Contadas por el censo de 2018/.test(QV.texto) && /Proyectadas a \d{4}/.test(QV.texto) &&
      /Un pronóstico no es un dato contado/.test(QV.texto),
      (QV.texto.match(/Contadas por el censo de \d+\s*[\d.]+/) || [''])[0]);
    /* Se leen las baldosas, no el texto plano: la cifra va en <b> y el rótulo
       en <small>, así que al aplanar quedan pegadas («51,1%mujeres») y un
       patrón con espacio no casa nunca. */
    T('reparte por sexo, y los dos porcentajes suman 100',
      (function () {
        const n = r2 => Number(String(r2).replace('%', '').replace(',', '.'));
        const m = QV.kpis.filter(x => /mujeres/.test(x.r))[0];
        const h = QV.kpis.filter(x => /hombres/.test(x.r))[0];
        return !!m && !!h && Math.abs(n(m.v) + n(h.v) - 100) < 0.2;
      })(),
      QV.kpis.map(x => x.v + ' ' + x.r).join(' · '));
    /* Los cinco tramos de edad, que son los que hacen la pirámide. Sin ellos
       la caja salía con las cifras de población y nada más. */
    T('y trae los cinco tramos de edad',
      QV.barras.length >= 5 &&
      /0 a 14 años/.test(QV.texto) && /65 años o más/.test(QV.texto),
      QV.barras.slice(0, 5).join(' | ').slice(0, 120));
    /* Y los porcentajes de los tramos suman 100: si no, uno de los tramos se
       está contando dos veces o falta. */
    T('cuyos porcentajes suman 100',
      (function () {
        const p = (QV.texto.match(/·\s*(\d+)%/g) || []).map(x => Number(x.replace(/[^\d]/g, '')));
        return p.length >= 5 && Math.abs(p.reduce((a2, b2) => a2 + b2, 0) - 100) <= 2;
      })(),
      (QV.texto.match(/·\s*\d+%/g) || []).join(' ') || 'sin porcentajes');
    T('y dice cuál es el grupo que manda, con su consecuencia',
      /El grupo más numeroso es/.test(QV.texto) && /decide el programa/.test(QV.texto),
      (QV.texto.match(/El grupo más numeroso es[^.]*\./) || [''])[0].slice(0, 80));
    T('con el índice de envejecimiento',
      /índice de envejecimiento/.test(QV.texto), QV.kpis.map(x => x.v + ' ' + x.r).join(' · '));
    /* El ESTRATO, que hasta la v866 no salía en ninguna prueba: la ruta del
       DANE devolvía la consulta agrupada vacía, `distribucionEstrato` daba
       null y la línea no se imprimía. Se pide con su RANGO y no solo con el
       predominante: un sector de 2 a 4 no se lee igual que uno todo 3, y el
       promedio solo se los come. */
    T('y el estrato predominante con el rango que de verdad hay',
      /Estrato predominante/.test(QV.texto) && /de 2 a 4/.test(QV.texto),
      (QV.texto.match(/Estrato predominante[^<]{0,30}/) || ['sin estrato'])[0]);
  }

  console.log('\n  -- la hoja no se contradice a sí misma --');
  /* El cruce «Comparación con la ciudad» decía «sin cifra municipal
     comparable en esta hoja» y era verdad hasta la v858, que puso en la
     lámina B justamente esa cifra. El cruce se quedó viejo y la hoja pasó a
     contradecirse: un panel comparando con el municipio, y el cierre de la
     misma hoja diciendo que no hay con qué.

     Es la cuarta declaración de ausencia que resulta falsa, y la primera por
     quedarse vieja en vez de nacer mal. Así que la comprobación no persigue
     ese cruce: persigue la CLASE. Para cada cosa que la hoja mide, se
     comprueba que ningún texto de la misma hoja la dé por ausente. */
  const PARES = [
    { que: 'la cifra municipal',
      mide: t => /% de .* vive acá|Población de .*\(proyectada/.test(t),
      niega: t => /sin cifra municipal comparable/.test(t) },
    { que: 'la isócrona por la malla',
      mide: t => /medido caminando por las calles/.test(t),
      niega: t => /isócronas? por (la )?malla|se alcanza a pie se mide en línea recta/i.test(t) },
    { que: 'las rutas que paran en el sector',
      mide: t => /Las rutas que paran acá/.test(t),
      niega: t => /no qué ruta para en cada una/.test(t) },
    { que: 'las manzanas cerradas',
      mide: t => /manzanas no se dedujeron/.test(t),
      niega: t => /El módulo de arriba se deduce/.test(t) },
    /* El par que la v865 debía agregar y no agregó: midió escolaridad y
       alfabetismo del censo y dejó la tabla con los cuatro pares de la v864.
       OJO con el alcance: la hoja sigue diciendo, con razón, que le falta «el
       estrato y la escolaridad DE LA CIUDAD» —esa es otra escala y otra
       tabla del DANE—, así que la negación tiene que ser la del SECTOR. */
    { que: 'lo que el censo trae además de sexo y edad',
      mide: t => /Contado sobre \d+ campos? de la capa/.test(t),
      niega: t => /(censo|módulo)[^.]{0,40}no (trae|lee)[^.]{0,40}(escolarid|hogares|alfabet|etnia)/i.test(t) ||
                  /(escolarid\w*|hogares)[^.]{0,60}no (está|están) en (el|este) censo/i.test(t) },
    /* El estrato nunca se declaró ausente en la HOJA —se declaró en
       CLAUDE.md, y de eso se ocupa `revisar.js` desde la v866—. Va igual:
       cuesta tres líneas y tapa el camino por el que llegaron las otras
       cuatro, que fue escribir la carencia de memoria. */
    { que: 'el estrato del sector',
      mide: t => /Estrato predominante/.test(t),
      niega: t => /(el )?estrato[^.]{0,40}(sin dato|no se conoce|no lo trae)/i.test(t) }
  ];
  const textoB = (r.soloB || '') + (r.soloA || '');
  const plano = textoB.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  PARES.forEach(p => {
    const lo = p.mide(plano);
    T('si la hoja mide ' + p.que + ', ningún texto suyo la da por ausente',
      !lo || !p.niega(plano),
      lo ? (p.niega(plano) ? 'LA MIDE Y LA NIEGA' : 'la mide, y no la niega') : 'no la mide en este sector');
  });

  console.log('\n  -- el censo se pregunta qué trae (v865) --');
  /* Escolaridad y hogares se venían dando por ausentes sin haberlo
     comprobado: el módulo pedía los veintitrés campos que conoce y de ahí
     concluía que el censo «no trae» lo demás. Ahora le pregunta a la capa
     por su lista de campos y separa TRES estados, que significan cosas
     distintas y no se pueden confundir. */
  const CE = (B.paneles || {}).censo;
  T('el panel está, y en la lámina B', !!CE && !(A.paneles || {}).censo);
  if (CE) {
    /* La capa del sector de prueba declara escolaridad y alfabetismo, y no
       declara hogares ni etnia: así una sola corrida ejercita los dos
       caminos. */
    T('cuenta los bloques que la capa sí declara',
      /Nivel educativo/.test(CE.texto) && /Alfabetismo/.test(CE.texto) &&
      CE.barras.length >= 4,
      CE.barras.slice(0, 4).join(' | ').slice(0, 120));
    /* Y dice con qué campo los contó: sin eso, la cifra no se puede
       rastrear hasta la fuente. */
    T('y nombra el campo de la capa con el que los contó',
      /ESCOLARIDAD_/.test(CE.texto) && /sumados por el radio analizado/.test(CE.texto),
      (CE.texto.match(/Contado sobre[^.]*\./) || [''])[0].slice(0, 130));
    /* Lo que la capa NO expone se declara con la evidencia: cuántos campos
       tiene y cómo se llaman. Es una afirmación que cualquiera puede
       comprobar abriendo la misma capa, no una suposición. */
    T('lo que la capa no expone va declarado con la lista de campos como prueba',
      CE.vacios.some(x => /no expone/.test(x)) &&
      /Hogares por tipo/.test(CE.falta.join(' ')) &&
      /declara <b>\d+<\/b>|declara \d+/.test(CE.falta.join(' ')),
      (CE.falta[0] || 'no lo declara').slice(0, 150));
    T('y da una muestra de los nombres, para poder mirarlos',
      /los numéricos empiezan por/.test(CE.falta.join(' ')) &&
      /SEXO_M|ESCOLARIDAD/.test(CE.falta.join(' ')),
      (CE.falta.join(' ').match(/empiezan por [^.]*/) || [''])[0].slice(0, 110));
    /* Y lo más importante de los tres estados: «no se pudo preguntar» no se
       imprime cuando SÍ se preguntó. Confundirlo con «no lo tiene» sería
       exactamente la mentira que este panel existe para no decir. */
    T('y no dice que no pudo preguntar, porque sí preguntó',
      !/No se pudo preguntar/.test(CE.texto),
      CE.vacios.join(' | ').slice(0, 90));
  }

  /* ── v874 · Los defectos de impresión ────────────────────────────────
     Cuatro cosas que salieron impresas en el pliego real del 12 de septiembre
     de 2026 y que ninguna comprobación miraba. Ninguna es un fallo de cálculo:
     las cuatro son cifras correctas dichas de una manera que no se puede
     leer, y por eso ninguna suite las veía. */
  console.log('\n  -- lo que sale impreso se puede leer --');

  /* 1 · Una razón grande se dice en VECES. «el lote ocupa cerca del 15978 %
     de una manzana mediana» es cierto y no significa nada. En este sector el
     lote mide 179.009 m² contra una manzana mediana de 20.000: 895 %, que es
     justo el otro lado del corte de 300 % — así que la rama se ejercita. */
  {
    const PRE = [A, B].map(x => (x.cruces || []).join(' ')).join(' ');
    const razon = (PRE.match(/el lote (mide [\d.,]+ veces el área|ocupa cerca del [\d.,]+ %)/) || [])[1] || '';
    T('el cruce de predios compara el lote con la manzana medida', !!razon, razon || PRE.slice(0, 90));
    /* La comprobación es sobre la FORMA, no sobre el número: pasado el 300 %
       el porcentaje deja de ser legible, y da igual si mañana el sector de
       prueba cambia de tamaño. */
    const pct = Number((razon.match(/del ([\d.,]+) %/) || [])[1] || 0);
    T('y si la razón se pasa del 300 % la dice en veces, no en por ciento',
      !(pct > 300), razon);
  }

  /* 2 · La concordancia. «1 piezas de servicios registradas» se lee como un
     descuido de quien firma la hoja. Se persigue la CLASE y no esa frase: en
     toda la hoja, un «1» seguido de palabra no puede ir en plural. La lista
     de invariables está para las que en castellano acaban en -s en singular;
     si aparece una nueva, se agrega acá y se ve por qué. */
  {
    const INVARIABLES = /^(análisis|síntesis|crisis|dosis|tesis|país|mes|bus|gas|atlas|virus|campus|corpus|oasis|más|menos|jueves|lunes|martes|miércoles|viernes)$/;
    const plural = [];
    [A, B].forEach(h => {
      const t = (h.texto || '').replace(/\s+/g, ' ');
      let m; const re = /(?<![\d.,])1 ([a-záéíóúüñ]+)\b/g;
      while ((m = re.exec(t))) {
        if (/s$/.test(m[1]) && !INVARIABLES.test(m[1])) plural.push(m[0]);
      }
    });
    T('ningún «1» de la hoja va seguido de un plural', plural.length === 0,
      plural.slice(0, 4).join(' · ') || 'ninguno');
  }

  /* 3 · Los nombres de campo del censo. `NIVEL_EDUC_ESP_MAES_DOC` salió como
     etiqueta de una barra. Un nombre de columna es el identificador con el
     que se rastrea el dato y su sitio es el pie de fuente —donde sigue,
     comprobado tres aserciones más arriba—, no el rótulo que se lee. */
  {
    const CE2 = B.paneles.censo;
    if (!CE2 || !CE2.barras.length) {
      T('el panel del censo trae barras que rotular', false, 'no hay panel del censo');
    } else {
      const crudas = CE2.barras.map(x => (x.match(/^[^\d]*/) || [''])[0].trim())
        .filter(x => x && /^[A-Z0-9_]+$/.test(x));
      T('ninguna barra del censo se rotula con el nombre crudo del campo',
        crudas.length === 0, crudas.slice(0, 3).join(' · ') || 'ninguna');
      /* Y la etiqueta tiene que decir algo, no ser el nombre en minúsculas.
         Se busca a propósito una palabra que NINGÚN alias del doble trae:
         «primaria» o «secundaria» las escribe la capa, así que comprobarlas
         pasaría igual sin fabricar nada. «Especialización» y «maestría» solo
         pueden salir de desatar `ESP` y `MAES`. */
      T('y las abreviaturas quedan desatadas en la etiqueta',
        /especializaci|maestr|doctorado|sin información/i.test(CE2.barras.join(' ')),
        CE2.barras.slice(-3).join(' | ').slice(0, 130));
    }
  }

  /* 4 · Los hitos. Tres de los nueve del pliego real eran moteles. Un hito es
     un referente de orientación colectiva; un motel, un bar, una funeraria,
     una bomba o una bodega no lo son — y siguen contando como USOS, que es
     donde les corresponde. El sector de prueba trae los cinco con nombre
     propio desde esta versión: sin ellos esta comprobación pasaría por no
     tener nada que rechazar, que es el peor verde que hay. */
  {
    const hs = [...(A.hitos || []), ...(B.hitos || [])];
    const ALTO = /Motel|Bar La Esquina|Funeraria|Terpel|Bodega/i;
    const IMP = /alto impacto/i;
    /* Que estén se comprueba por donde SÍ salen: la lectura de usos. La hoja
       no imprime el nombre de cada punto —solo el de los hitos—, así que
       buscarlos por nombre en el texto daría cero tanto si el sector los trae
       como si no, y ese cero no distingue una cosa de la otra. Las dos
       categorías son suyas y de nadie más: los 220 puntos genéricos son
       farmacia, colegio, banco, restaurante y policía. */
    const USOS = (A.texto + ' ' + B.texto).replace(/\s+/g, ' ');
    T('el sector de prueba trae usos de alto impacto, y se cuentan como usos',
      /Industria y logística [1-9]/.test(USOS) && /Vivienda y ocio [1-9]/.test(USOS),
      (USOS.match(/Industria y logística \d+|Vivienda y ocio \d+/g) || []).join(' · ') ||
        'si esto falla, las dos de abajo pasan por no tener qué rechazar');
    T('y ninguno de ellos entra a la lista de hitos',
      hs.length > 0 && !hs.some(h => ALTO.test(h.nombre)),
      hs.map(h => h.nombre).join(' · ').slice(0, 120) || 'no hay hitos');
    T('ni queda en pie la categoría «servicios de alto impacto»',
      !hs.some(h => IMP.test(h.cat)),
      hs.map(h => h.cat).join(' · ').slice(0, 110) || 'sin categorías');
  }

  T('y la página no soltó errores', err.length === 0, err.slice(0, 2).join(' · ') || 'ninguno');

  console.log('\n  ' + (mal ? mal + ' comprobaciones fallaron' : 'todo en verde'));
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
