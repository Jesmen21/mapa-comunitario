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
/* §8 (v890) · EL LOTE ES UN PREDIO, no media hacienda.
   ────────────────────────────────────────────────────────────────────────
   Hasta la v889 esto era un polígono de veintidós lados y 245 m de radio:
   **dieciocho hectáreas**, que no es un lote —el pliego de ajustes lo dijo
   de la corrida real: «el "lote" tenía 871.935 m² (87 ha), que no es un
   lote»—. Todo lo que la lámina mide sobre el predio se estaba probando a
   una escala a la que un predio no existe.

   Ahora son **unos 3.000 m²**, que es un predio urbano grande pero real, con
   ocho lados de largos distintos para que el reparto por sol siga teniendo
   algo que repartir. Los veintidós lados no se pueden conservar a esta
   escala y por una razón física, no de gusto: a 33 m de radio los vértices
   quedan a dos píxeles unos de otros en el zoom del mapa, y el dibujo los
   funde. Ocho ya no.

   Y se dibuja con el mapa ACERCADO, que es lo que hace cualquiera para
   marcar un predio: a zoom 15 un lote de 3.000 m² mide dieciocho píxeles de
   punta a punta. */
const RL = 33 / 111320;                       // 33 m de radio → unos 3.000 m²
const NL = 8;
const LOTE = [];
for (let i = 0; i < NL; i++) {
  const a = i * 2 * Math.PI / NL, rr = RL * (0.75 + 0.5 * ((i * 3) % 5) / 4);
  LOTE.push({ lat: C.lat + Math.cos(a) * rr,
              lng: C.lng + Math.sin(a) * rr / Math.cos(C.lat * Math.PI / 180) });
}
/* Los usos del sector. Iban TODOS en un patrón circular parejo, y eso dejaba
   una rama a oscuras que no se veía: el eje mayor de cada mancha (§4, v877)
   salía «sin eje dominante» en las cuatro categorías, porque una nube redonda
   no tiene rumbo. La comprobación del rumbo habría pasado sin comprobar nada.

   Ahora las FARMACIAS van sobre un corredor —alineadas a lo largo de una
   diagonal, como se alinean de verdad sobre la avenida— y las demás siguen
   repartidas. Así el sector ejercita las dos ramas: una categoría con eje
   medido y tres sin él, que también es un dato —un uso repartido parejo no
   se lee igual que uno en corredor—. */
const usos = [];
for (let i = 0; i < 220; i++) {
  const cual = ['pharmacy', 'school', 'bank', 'restaurant', 'police'][i % 5];
  if (cual === 'pharmacy') {
    // El corredor: a lo largo de una diagonal, con poca dispersión al través.
    const t = (i / 5) / 44;                       // 0 a 1 a lo largo del eje
    const largo = (-420 + t * 840) / 111320;      // 840 m de corredor
    const ancho = (((i * 7) % 5) - 2) * 14 / 111320;
    usos.push({ type: 'node', id: 2000 + i,
      lat: C.lat + largo * 0.72 + ancho * 0.69,
      lon: C.lng + (largo * 0.69 - ancho * 0.72) / Math.cos(C.lat * Math.PI / 180),
      tags: { name: 'Sitio ' + i, amenity: cual } });
    continue;
  }
  const a = i * 11 * Math.PI / 180, d = (120 + (i % 7) * 70) / 111320;
  usos.push({ type: 'node', id: 2000 + i, lat: C.lat + Math.cos(a) * d, lon: C.lng + Math.sin(a) * d,
    tags: { name: 'Sitio ' + i, amenity: cual } });
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
  /* Las alturas, repartidas como en un barrio colombiano corriente y no como
     una escalera pareja (§10, v880). Iban 3 + (i % 5) pisos, así que TODOS
     caían en los dos cajones de arriba: la moda y la mediana daban lo mismo,
     y el panel del potencial no podía enseñar lo que existe para enseñar
     —que con la mayoría en un piso, la media describe un sector que no hay—.

     El reparto de la corrida real: casi seis de cada diez de un piso, y unas
     pocas torres. Con esto la media sale por encima de dos y la moda dice
     «un piso», que es la diferencia que el pliego pide imprimir. */
  Array.from({ length: 30 }, (_, i) => edif(-560 + (i % 10) * 115,
    -400 + Math.floor(i / 10) * 220, 60, 90,
    i < 17 ? 1 : i < 23 ? 2 : i < 27 ? 3 : [5, 7, 9][i - 27])),
  /* §11 (v884) · una quebrada que cruza el sector. Sin ella el descuento de
     la franja de ronda no se ejercitaba en ninguna prueba: el panel habría
     salido en verde declarando «no hay ningún cauce mapeado», que es la otra
     rama y la que ya cubre `tsinmapear`. Es la séptima vez que el material
     de prueba era más pobre que un sector real (v862, v866, v874, v877,
     v880, v882, y esta).

     Va como `way["waterway"]` con su recorrido, que es como llega de verdad
     en la consulta del trazado —`out geom`—, y no como un punto: de un punto
     no sale una franja. */
  [{ type: 'way', id: 900001, tags: { waterway: 'stream', name: 'Quebrada Seca' },
     geometry: [P(-600, -460), P(-300, -380), P(0, -300), P(300, -260), P(600, -180)]
       .map(q => ({ lat: q.lat, lon: q.lng })) }]
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
    /* §8 · acercarse para marcar el predio. A zoom 15 los ocho vértices de un
       lote de 3.000 m² caen a dos píxeles unos de otros. */
    window.map.setView([C.lat, C.lng], 19); await esperar(400);
    for (const p of LOTE) { window.map.fire('click', { latlng: { lat: p.lat, lng: p.lng } }); await esperar(40); }
    const bc = document.querySelector('#pcr-lote-barra [data-lote="cerrar"]');
    if (bc) { bc.click(); await esperar(900); }
    window.map.setView([C.lat, C.lng], 15); await esperar(300);
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
    /* §1 · los otros dos campos de identificación, escritos como los
       escribiría alguien. Se llenan los TRES en el documento principal
       porque la comprobación de la cabecera es sobre una lámina nombrada;
       la rama del campo en blanco se compone aparte, más abajo, que es la
       lección de siempre: una sola corrida no enseña las dos ramas. */
    const cp = document.getElementById('pcr-proyecto');
    if (cp) { cp.value = 'Taller VII · análisis de sector'; cp.dispatchEvent(new Event('input', { bubbles: true })); }
    const cu = document.getElementById('pcr-ubicacion');
    if (cu) { cu.value = 'Comuna 1, Cúcuta, Norte de Santander'; cu.dispatchEvent(new Event('input', { bubbles: true })); }
    /* El botón de ver la lámina: desde la v853 entrega LAS DOS en un
       documento de dos páginas. Es lo que sale a imprimir. */
    const bv = H().querySelector('[data-pcr="lamina-ver"]');
    if (bv) { bv.click(); await esperar(600); }
    o.doc = capturado; capturado = '';
    /* §2 (v899) · LA HOJA A LA QUE UN PANEL LE CEDIÓ EL SITIO.
       ────────────────────────────────────────────────────────────────────
       Los doce chequeos cruzados leen el TEXTO de las cajas compuestas, y
       una caja que cedió su sitio para que la hoja cierre no está en ese
       texto. El chequeo entonces no la encuentra y dice «sin dato» — sobre
       una cifra que el módulo midió y que la ficha nombra en la lista de lo
       que cedió. Es la clase de la v861 dicha en el panel de coherencia.

       Se compone con los dos paneles de §2 apagados a propósito. Sin esta
       rama la comprobación pasaría por no tener nada que rechazar: en la
       hoja normal los dos paneles están y los dos chequeos pasan. */
    o.docCede = R.laminaDoble({ pliegoOff: ['suelo-disponible-real', 'potencial-edificatorio'] });
    /* §5 (v900) · EL PIE QUE SE CONTRADECÍA A SÍ MISMO.
       ────────────────────────────────────────────────────────────────────
       El pliego v2 lo trajo de la lámina B real: listaba dieciséis mapas por
       debajo del mínimo de 8 cm y en la frase siguiente afirmaba «Todos
       alcanzan el objetivo del pliego».

       `veredictoDeTamanos` saca del recuento de OBJETIVO al mapa que ya cayó
       por el PISO, así que la frase de cumplimiento sale sola cuando TODO lo
       que se queda corto se quedó corto por abajo del piso. En la hoja
       normal de esta suite hay mapas en el tramo de en medio —92 mm de 100—
       y por eso la contradicción no aparece: la comprobación pasaría por no
       tener nada que rechazar.

       Se apagan los mapas de categoría, que son justo los del tramo de en
       medio. Lo que queda son los de 65 y 75 mm, todos por debajo del piso,
       y la lista de objetivo se vacía: es el estado exacto del reporte. */
    o.docPieContra = R.laminaDoble({ pliegoMapasOff:
      ['calor:todos', 'calor:comercio', 'calor:institucional', 'calor:salud', 'calor:cultura',
       'hitos', 'comercial', 'anillos'] });
    /* §1 · el nombre del archivo exportado. Se mide donde de verdad se
       decide —en la llamada que baja el PDF— y no leyendo la función: es la
       regla de la v863. Un doble del armador de PDF, que no dibuja nada y
       solo apunta con qué nombre se pidió bajarlo. */
    var bajadoComo = '';
    window.URBIS_PLIEGO_PDF = {
      disponible: function () { return true; },
      generar: function () { return Promise.resolve({ blob: new Blob(['x']), bytes: 1024, dpi: 300 }); },
      bajar: function (blob, nombre) { bajadoComo = nombre; }
    };
    var bpdf = H().querySelector('[data-pcr="lamina"]');
    if (bpdf) { bpdf.click(); await esperar(1200); }
    o.archivo = bajadoComo;
    o.fuera = ((R.estado() || {}).pliegoFuera || []).slice();
    // §4 (v901): el veredicto del control de cierre de la última composición.
    o.cierre = (R.estado() || {}).pliegoCierre || null;
    // Y cada hoja por separado, para poder pedirle a cada una lo suyo.
    /* La A suelta se pide CON clima: la caja del clima es la que prueba que
       un dato de ciudad no se rotula como del sector, y en este banco no hay
       servidor de clima al que consultarle. Se inyecta por opciones, que es
       para lo que `laminaA` las acepta. */
    /* §12 (v882): el clima inyectado trae ahora la ROSA de los ocho rumbos,
       el viento medio y la RADIACIÓN medida. Sin ellos la caja del clima
       imprimía la temperatura y la lluvia y nada más, así que la estrategia
       de ventilación y la radiación del asoleamiento no se ejercitaban en
       ninguna prueba: el panel habría pasado en verde por no tener nada que
       decir. Es la sexta vez que el fixture era más pobre que un sector real
       (v862, v866, v874, v877, v880, y esta).

       El viento dominante va del NORTE a propósito: en esta latitud la
       orientación que más sol recibe es el oriente, así que el caso normal
       —ventilar sin chocar con el sol— es el que sale en la hoja. El choque
       se prueba aparte, con su propia inyección, porque las dos ramas dicen
       cosas opuestas y una sola corrida no puede enseñar las dos. */
    const ROSA = [
      { rumbo: 'norte', pct: 31 }, { rumbo: 'nororiente', pct: 18 },
      { rumbo: 'oriente', pct: 9 }, { rumbo: 'suroriente', pct: 6 },
      { rumbo: 'sur', pct: 8 }, { rumbo: 'suroccidente', pct: 7 },
      { rumbo: 'occidente', pct: 10 }, { rumbo: 'noroccidente', pct: 11 }
    ];
    const CLIMA = {
      temperatura: { media: 27.4, max: 33, min: 21 }, lluvia: { anual: 1180 },
      viento: { dominante: { rumbo: 'norte', pct: 31 }, mediaKmh: 9.4, rosa: ROSA },
      radiacion: { mediaKwhDia: 5.12, masAlto: { mes: 'agosto', kwh: 5.94 },
                   masBajo: { mes: 'noviembre', kwh: 4.31 }, mesesConDato: 12, dias: 1820,
                   plano: 'horizontal', fuente: 'reanálisis ERA5 servido por Open-Meteo, 5 años' }
    };
    /* §11 (v884): el descuento de pendiente pide el modelo de elevación por
       celda, y ese se mide con el botón del terreno —que tarda casi medio
       minuto: `tterreno` le da hasta 28 s—. Cargárselo a esta suite, que es
       de las dos láminas y no del terreno, sería pagar ese medio minuto en
       cada corrida de la batería.

       Se INYECTA, igual que el clima desde la v882: `laminaA` acepta
       `terreno` por opciones. Así se componen las dos ramas —con pendiente
       fuerte medida y sin terreno medido— y cada una se comprueba por lo que
       tiene que decir, que es lo que una sola corrida no puede enseñar. */
    const TERRENO = {
      pendiente: { media: 11.4, maxima: 38.2,
        clases: [
          { id: 'plano',  etiqueta: 'Plano o casi plano', nodos: 120, pct: 40 },
          { id: 'suave',  etiqueta: 'Pendiente suave',    nodos: 90,  pct: 30 },
          { id: 'media',  etiqueta: 'Pendiente media',    nodos: 54,  pct: 18 },
          { id: 'fuerte', etiqueta: 'Pendiente fuerte',   nodos: 36,  pct: 12 }
        ] } };
    /* La A de REFERENCIA, con las mismas opciones que usa el documento que
       sale a imprimir —o sea ninguna—: es contra esta que se comprueba que
       nada se cayó en silencio. Comparar contra la A con clima inyectado
       denunciaría «El clima» como panel perdido cuando lo que pasa es que el
       documento no lo tenía nunca. */
    o.refA = R.laminaA({ hoja: 'A' });
    o.soloA = R.laminaA({ hoja: 'A', clima: CLIMA });
    // Con el terreno medido: la cascada descuenta la pendiente fuerte.
    o.conTerreno = R.laminaA({ hoja: 'A', clima: CLIMA, terreno: TERRENO });
    o.soloB = R.laminaA({ hoja: 'B' });
    // La rama del conflicto: el aire entra justo por donde más pega el sol.
    o.choque = R.laminaA({ hoja: 'A', clima: Object.assign({}, CLIMA, {
      viento: { dominante: { rumbo: 'oriente', pct: 34 }, mediaKmh: 4.1, rosa: ROSA } }) });
    // Y la rama sin radiación: el archivo no siempre la trae en un punto.
    o.sinRad = R.laminaA({ hoja: 'A', clima: Object.assign({}, CLIMA, { radiacion: null }) });
    /* §1 · la rama del campo vacío. Un campo en blanco no se calla: se
       imprime «SIN NOMBRAR» en rojo. Sin esta hoja aparte la comprobación
       pasaría por no tener nada que rechazar, que es el verde que este
       proyecto lleva seis tandas persiguiendo. */
    o.sinProyecto = R.laminaA({ hoja: 'A', proyecto: '', clima: CLIMA });
    /* §17 · la rama MEDIDA de la presión de crecimiento. La serie de fotos
       no se pide en esta suite —son diez descargas y esto es la lámina—, así
       que la tendencia se inyecta por opciones, igual que el clima desde la
       v882 y el terreno desde la v884. Sin esto la huella construida saldría
       siempre «serie satelital no leída» y el proxy que §17 pide no se
       ejercitaría en ninguna prueba, que es el agujero de la v874. */
    o.conSerie = R.laminaA({ hoja: 'A', clima: CLIMA, evo: { wayback: { tendencia: {
      desde: 2014, hasta: 2024, aniosUsados: 6,
      verde: -7.2, duro: 9.4, agua: 0, viva: -6.1,
      verdeDesde: 38.4, verdeHasta: 31.2, duroDesde: 44.1, duroHasta: 53.5,
      aguaDesde: 3, aguaHasta: 3 } } } });
    /* §1 (v910) · LA SERIE MEDIDA Y SU PANEL FUERA DE LA HOJA.
       ────────────────────────────────────────────────────────
       El pliego real lo trajo así: la banda de la serie temporal no estaba
       en la lámina A y la síntesis de la B seguía afirmando «2,6 puntos de
       superficie dura entre 2014 y 2026». Las dos mitades tienen que darse
       a la vez para producirlo —la serie MEDIDA y el panel CEDIDO— y en
       esta suite no se daban: la hoja normal no inyecta la tendencia, así
       que sus dos casillas salían «SIN MEDIR» por su cuenta y la
       comprobación habría pasado por no tener nada que rechazar. Es el
       agujero que este proyecto lleva quince tandas persiguiendo.

       Se componen las DOS ramas con la misma tendencia inyectada: con la
       banda puesta —las casillas citan— y con la banda cedida —las
       casillas dicen que la hoja no las sostiene, y cómo devolverlas—. */
    /* Con sus PASOS y no solo la tendencia: el inventario marca la caja
       `listo` contando pasos medidos, así que sin ellos la caja no se compone
       y lo único que se ejercitaba era la casilla de la otra lámina — que es
       justo la divergencia que la v911 unificó. Cinco estampas, como las que
       `aniosDe` produce de 2014 a 2026 con paso 3. */
    var EVO_SERIE = { wayback: {
      pasos: [2014, 2017, 2020, 2023, 2026].map(function (a, i) {
        return { anio: a, ok: true, medida: { verde: 38.4 - i * 1.8, duro: 44.1 + i * 2.35 } };
      }),
      tendencia: {
        desde: 2014, hasta: 2026, aniosUsados: 5,
        verde: -7.2, duro: 9.4, agua: 0, viva: -6.1,
        verdeDesde: 38.4, verdeHasta: 31.2, duroDesde: 44.1, duroHasta: 53.5,
        aguaDesde: 3, aguaHasta: 3 } } };
    /* En el DOCUMENTO, que es el que pasa por la bisección: `laminaA` compone
       directo y el cuerpo de la caja siempre leyó `o.evo`, así que medir con
       ella no distingue una versión de la otra. Lo que decidía el inventario
       —y por tanto `ordenDeSacrificio`— es lo que estaba partido. */
    o.serieEnA = R.laminaDoble({ clima: CLIMA, evo: EVO_SERIE });
    /* Y apretada: con el inventario leyendo `S.evo` la caja se componía pero
       quedaba FUERA de la lista de candidatos —`ordenDeSacrificio` la daba por
       no lista—, así que era inmune por accidente. Eso es lo que distingue
       una versión de la otra, y no que la caja salga o no salga. */
    R.laminaDoble({ letra: 'grande', clima: CLIMA, evo: EVO_SERIE });
    o.serieCandidata = ((R.estado() || {}).pliegoFuera || [])
      .indexOf('como-cambio-el-sitio') >= 0;
    o.serieEntera = R.laminaA({ hoja: 'B', clima: CLIMA, evo: EVO_SERIE });
    o.serieCedida = R.laminaA({ hoja: 'B', clima: CLIMA, evo: EVO_SERIE,
                                pliegoOff: ['como-cambio-el-sitio'] });
    /* La bibliografía va al pie de la B y cita la fuente de la serie. Con la
       banda fuera, esa entrada cita un trabajo que el lector no tiene. */
    o.bibEntera = /Planetary Computer/.test(o.serieEntera || '');
    o.bibCedida = /Planetary Computer/.test(o.serieCedida || '');
    /* §20 (v889) · la rama en la que la factibilidad SÍ separa a los cinco.
       El lote de esta suite son dieciocho hectáreas: ahí caben los ocho usos
       típicos y la etiqueta sale igual para todos —lo que es correcto y es
       justo por lo que no se imprime cinco veces—. Sin un segundo lote, la
       rama que la imprime quedaría sin ejercitar y la comprobación pasaría
       por no tener nada que rechazar, que es el agujero que este proyecto
       lleva ocho tandas persiguiendo.

       Se dibuja con los botones de verdad —borrar, dibujar, cerrar—, no
       escribiéndole a `S`: es la regla de la v871. Un predio de 601 m², que
       es un lote urbano corriente: el comercio sobra, la salud queda justa y
       el colegio queda corto. */
    const bb = H().querySelector('[data-pcr="lote-borrar"]');
    if (bb) { bb.click(); await esperar(300); }
    const bd2 = H().querySelector('[data-pcr="lote-dibujar"]');
    if (bd2) { bd2.click(); await esperar(400); }
    const g = 0.0000899;                       // unos 10 m de latitud
    const CHICO = [[-1, -1.5], [1, -1.5], [1, 1.5], [-1, 1.5]].map(function (v) {
      return { lat: C.lat + v[1] * g, lng: C.lng + v[0] * g / Math.cos(C.lat * Math.PI / 180) }; });
    for (const q of CHICO) { window.map.fire('click', { latlng: q }); await esperar(60); }
    const bc2 = document.querySelector('#pcr-lote-barra [data-lote="cerrar"]');
    if (bc2) { bc2.click(); await esperar(900); }
    R.abrir(); await esperar(400);
    o.loteChico = R.laminaA({ hoja: 'B' });
    /* §8 (v890) · la otra rama de la escala: el caso que el pliego reportó.
       «Radio de 2.500 m: 19,63 km², 77.145 habitantes. Eso no es un sector,
       es un tercio de Cúcuta». El sector de esta suite mide 1,77 km² —750 m
       de radio equivalente, justo el rango que §8 pide—, así que el aviso de
       escala grande no se ejercitaría en ninguna prueba y la comprobación
       pasaría por no tener nada que rechazar: es el agujero que este
       proyecto lleva nueve tandas persiguiendo.

       Se vuelve a analizar de verdad, con un polígono de 2.500 m de radio
       equivalente y el botón de siempre. Cuesta una consulta más y los 5,2 s
       del limitador de Overpass; enseñar la rama los vale. */
    const G = 2500 / 111320 * Math.sqrt(Math.PI) / 2;   // medio lado de un cuadrado de 19,6 km²
    await esperar(5200);
    A.iniciarDibujo();
    [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].forEach(function (v) {
      A.agregarPunto(C.lat + v[1] * G, C.lng + v[0] * G / Math.cos(C.lat * Math.PI / 180));
    });
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1500);
    o.granEscala = R.laminaA({ hoja: 'A', clima: CLIMA });
    /* Y el TRAZADO de esa corrida. Sin él, los paneles de suelo disponible y
       de potencial edificatorio no existen en la hoja grande, y los dos
       chequeos que §2 persigue saldrían «sin dato» con razón —por no haber
       nada que leer— en vez de por no saber leerlo. Medir la cosa
       equivocada es lo que esta suite lleva tres tandas evitando. */
    await esperar(5200);
    o.trazadoGran = await medir('trazado', '.pcr-llenos');
    /* §2 (v899) · LAS DOS HOJAS a la escala de la corrida real.
       ────────────────────────────────────────────────────────────────────
       Los doce chequeos cruzados viven en la hoja B y comparan contra la A,
       así que una hoja A suelta no los produce: hasta la v898 esta corrida
       de 19,6 km² componía solo la A y los chequeos no se medían nunca a
       esta escala.

       Y la escala es justo lo que los rompe. A 177 ha la cascada de suelo
       imprime «131 ha» y a 19,6 km² imprime «1.627,1 ha» — con separador de
       miles, que es lo que el lector de áreas no sabía leer. El sector
       chico no puede producir el fallo: es la decimocuarta vez. */
    const bv2 = H().querySelector('[data-pcr="lamina-ver"]');
    if (bv2) { bv2.click(); await esperar(700); }
    o.docGran = capturado; capturado = '';
    /* §4 (v911) · LO QUE CEDE DE VERDAD, y por eso se mide acá.
       ──────────────────────────────────────────────────────────
       El sector de 750 m compone las dos hojas SIN ceder nada, así que el
       orden de cesión no se ejercita en ninguna prueba: cualquier cambio de
       peldaño entraría a ciegas — que es exactamente lo que la v910 midió y
       por lo que no lo tocó. A 19,6 km² la hoja sí se llena y la bisección
       cede, así que ESTA corrida es el único material de la batería que
       puede juzgar la lista de peldaños. */
    /* Una sola lista: `pliegoFuera` junta cajas y mapas, porque la bisección
       los cede de la misma lista de candidatos. */
    o.fueraGran = ((R.estado() || {}).pliegoFuera || []).slice();
    /* Y la misma hoja con la letra de colgar. Dos paneles cediendo no
       distinguen un orden de otro: con el piso en 0,80 la bisección tiene
       que bajar hasta el peldaño 3 y ahí SÍ se ve el orden entero. Es una
       opción de verdad de la aplicación —«Se lee de pie», para colgar con
       menos cajas—, no una puerta trasera de pruebas. */
    /* Con `laminaDoble`, que es la que corre la BISECCIÓN: `laminaA` llama a
       `laminaImprimible` directo y no cede nada, así que medir con ella el
       orden de cesión sería medir otra cosa de la que se dice. */
    o.granPie = R.laminaDoble({ letra: 'grande' });
    o.fueraPie = ((R.estado() || {}).pliegoFuera || []).slice();
    /* Y la MISMA caja apagada a mano desde la ficha. El renglón de banda
       incompleta dice «cedió el sitio para que la hoja cerrara»: sobre una
       caja que una persona apagó a propósito eso es declarar mal la causa,
       que es la falta de la v867. Sin esta rama, `pliegoOff` —que junta las
       dos cosas— habría dejado pasar el renglón en la hoja de cualquiera
       que use «dejar solo el plano». */
    o.apagadaAMano = R.laminaDoble({ pliegoOff: ['asoleamiento'] });

    /* ── LA FRANJA DE EXPORT DE PRUEBA (v914) ──────────────────────────
       Un PDF de muestra viaja SOLO: el LEEME que lo acompaña en el
       repositorio no lo sigue cuando alguien lo reenvía. Se comprueban las
       DOS ramas en la misma corrida, y la que más importa es la primera: una
       franja que saliera siempre marcaría de «prueba» el análisis de un
       predio real, que es la mentira contraria y peor que no marcar nada. */
    o.conFranja = R.laminaDoble({ pruebaDeFixture: true });

    return o;
  }, { C, POL, LOTE });

  /* El documento montado a tamaño real: las dos hojas, cada una con su
     reducción, medidas en milímetros de papel. */
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 2268, height: 3402 });
  await m.setContent(r.doc || '<i></i>', { waitUntil: 'load' });
  await m.waitForTimeout(700);
  /* El lector de una hoja compuesta. Se extrae con nombre —y no se escribe
     dentro del `evaluate`— porque desde la v901 se aplica a DOS documentos:
     el que sale a imprimir, que puede haber cedido paneles, y las dos hojas
     sueltas, donde están todos. Lo que un panel DICE se comprueba donde el
     panel existe; lo que la hoja compuesta tiene que cumplir es otra cosa y
     se comprueba aparte. Dos lectores para lo mismo divergirían a la tanda
     siguiente, que es la regla de la v879. */
  const LECTOR = () => {
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
        /* Y la misma hoja partida en NODOS de texto. `textContent` pega lo
           de dos elementos vecinos sin nada en medio, así que un «100» y un
           «100» de dos cajas contiguas se leen como «100100»: una cifra de
           seis dígitos que nadie imprimió. Las comprobaciones sobre cómo se
           escribe un número van sobre estos trozos, no sobre la tira. */
        trozos: (function () {
          const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT), t = [];
          while (w.nextNode()) { const x = w.currentNode.nodeValue.replace(/\s+/g, ' ').trim(); if (x) t.push(x); }
          return t;
        })(),
        /* §20 (v889) · las cinco propuestas del cierre, leídas una por una.
           «Cada propuesta tiene que citar su propio dato» no se puede
           comprobar sobre un párrafo: hay que comparar los cinco entre sí,
           así que cada renglón se lee por separado. */
        sitio: [...h.querySelectorAll('.pu-sitio')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
        props: [...h.querySelectorAll('.pu')].map(x => ({
          uso: ((x.querySelector('.pu-uso') || {}).textContent || '').trim(),
          razon: ((x.querySelector('.pu-razon') || {}).textContent || '').trim(),
          nec: ((x.querySelector('.pu-nec b') || {}).textContent || '').trim(),
          necTexto: ((x.querySelector('.pu-nec small') || {}).textContent || '').trim(),
          facRotulo: ((x.querySelector('.pu-fac i') || {}).textContent || '').trim(),
          fac: ((x.querySelector('.pu-fac b') || {}).textContent || '').trim(),
          facTexto: ((x.querySelector('.pu-fac small') || {}).textContent || '').trim()
        })),
        eyebrow: (h.querySelector('.ey') || {}).textContent || '',
        responde: (h.querySelector('.que-responde') || {}).textContent || '',
        neutral: (h.querySelector('.neutral') || {}).textContent || '',
        /* §1+§2 · la cabecera, leída pieza por pieza y no como un
           párrafo: el orden es lo que se comprueba, así que cada
           renglón se lee por su clase y se mide su tamaño en
           milímetros de papel. Un `textContent` de la cabecera
           entera pasaría con las cuatro piezas en cualquier orden. */
        h1: (h.querySelector('.tit h1') || {}).textContent || '',
        ubicAdm: (h.querySelector('.tit .ubic-adm') || {}).textContent || '',
        cifraHoja: (h.querySelector('.tit .cifra-hoja') || {}).textContent || '',
        alcance: (h.querySelector('.pie .alcance') || {}).textContent || '',
        /* §21 (v886) · el veredicto de tamaños que la hoja imprime, y las
           medidas de verdad para poder contrastarlo. Se comprueba que el
           renglón dice la MISMA cifra que sale de medir los mapas: un
           veredicto que no coincide con el papel es peor que ninguno. */
        tamanos: (h.querySelector('.tamanos') || {}).textContent || '',
        tamanosRojo: !!h.querySelector('.tamanos.corto'),
        ladosMapa: [...h.querySelectorAll('.mapa-caja, .plano-hero')].map(c => {
          const sv = c.querySelector('.mp-dib svg, .plano-cuerpo svg');
          const r = sv ? sv.getBoundingClientRect() : { width: 0, height: 0 };
          return { t: ((c.querySelector('h2') || {}).textContent || '').trim(),
                   mm: mm(Math.min(r.width, r.height)) };
        }).filter(x => x.mm > 0),
        leeAsi: (h.querySelector('.pie .lee-asi') || {}).textContent || '',
        /* Lo que queda en la CABECERA y lo que bajó al PIE. §2 pide
           que los tres párrafos de letra chica dejen de ocupar la
           franja que se lee de lejos, así que hay que mirar dónde
           está cada uno y no solo que esté. */
        cabTexto: ((h.querySelector('.cab') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
        pieTexto: ((h.querySelector('.pie') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
        sinNombrar: [...h.querySelectorAll('.sin-nombrar')].length,
        /* Los tamaños de la cabecera, en milímetros de papel: la
           jerarquía del pliego es de tamaño, no de orden. */
        mmH1: mm(parseFloat(getComputedStyle(h.querySelector('.tit h1')).fontSize) || 0),
        mmCifra: (function () {
          const b = h.querySelector('.tit .cifra-hoja b');
          return b ? mm(parseFloat(getComputedStyle(b).fontSize) || 0) : 0;
        })(),
        mmPie: (function () {
          const d = h.querySelector('.pie-abajo > div');
          return d ? mm(parseFloat(getComputedStyle(d).fontSize) || 0) : 0;
        })(),
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
        /* §1 (v899) · cada casilla del cierre, con su valor y su marca.
           Lo que se persigue es la CLASE: una casilla o trae una cifra, o va
           marcada como no medida. Una frase en el sitio de la cifra —«sin
           trazado medido», «ninguna clase con un punto mapeado»— se lee, a
           un palmo de «6,1 m²/hab», como si fuera un valor. */
        crucesDet: [...h.querySelectorAll('.cruce')].map(x => ({
          k: ((x.querySelector('.cv-k') || {}).textContent || '').trim(),
          v: ((x.querySelector('.cv-v') || {}).textContent || '').trim(),
          l: ((x.querySelector('.cv-l') || {}).textContent || '').trim(),
          sm: x.classList.contains('cruce-sm')
        })),
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
           —desde la v887— cuáles llevan un CONTORNO de verdad y qué
           superficie imprime cada uno. Hasta la v886 se contaban los marcos
           a trazos, que era la forma de decir «esto no es el límite de
           nadie»; §3 lo prohibió y ahora lo que hay que contar es lo
           contrario: que ninguna casilla esté vacía. */
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
            /* Una casilla DIBUJADA es la que trae una figura: un contorno
               (`path`) o el círculo del sector analizado por radio. El marco
               de la casilla es un `rect` y no cuenta — contarlo sería dar por
               buena exactamente la casilla vacía que §3 prohíbe. */
            conFigura: marcos.filter(g => g.querySelector('path, circle')).length,
            /* Y las superficies que imprime cada casilla, en el orden en que
               salen. Son el «salto de escala en números» que §3 pide. */
            areas: marcos.map(g => {
              const t = [...g.querySelectorAll('text')].map(x => x.textContent.trim());
              return (t[1] || '');
            }),
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
              // §19 (v880): el trámite con el que cada vacío deja de serlo.
              tramite: [...c.querySelectorAll('.comoq > .cq')].map(x => ({
                etq: ((x.querySelector('i') || {}).textContent || '').trim(),
                val: ((x.querySelector('span') || {}).textContent || '').replace(/\s+/g, ' ').trim() })),
              /* §11 (v884): los renglones de la cascada del suelo, cada uno
                 con su cifra y con de dónde sale el descuento. Se leen como
                 filas y no como texto corrido porque la comprobación es
                 sobre cada paso: un descuento sin origen impreso no se puede
                 discutir, que es justo lo que el panel viene a arreglar. */
              casc: [...c.querySelectorAll('.casc > .casc-p')].map(x => ({
                t: ((x.querySelector('span') || {}).textContent || '').trim(),
                m: ((x.querySelector('b') || {}).textContent || '').trim(),
                de: ((x.querySelector('i') || {}).textContent || '').trim(),
                resta: x.classList.contains('casc-resta'),
                fin: x.classList.contains('casc-fin') })),
              columnas: [...c.querySelectorAll('table.rad th')].map(x => x.textContent.trim()),
              filas: [...c.querySelectorAll('table.rad tr')].slice(1)
                .map(tr => [...tr.querySelectorAll('td')].map(x => x.textContent.trim())),
              banda: (c.closest('.banda') || {}).className || '',
              barras: [...c.querySelectorAll('.barras > .b')].map(x =>
                x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
              // El ANCHO de cada barra, no su texto: una comprobación sobre
              // qué barra es la más larga tiene que mirar la barra.
              anchoBarras: [...c.querySelectorAll('.barras > .b u')].map(x =>
                parseFloat((x.getAttribute('style') || '').replace(/^.*width:\s*/, '')) || 0),
              // Los pares SECTOR | CIUDAD | DIFERENCIA de la comparación
              // contra la ciudad (§9): se leen como filas, no como texto
              // corrido, porque la comprobación es sobre cada uno.
              pares: [...c.querySelectorAll('.pares > .par:not(.par-cab)')].map(x =>
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
          return { alejarse: dame(/Cómo cambia al alejarse/), riesgo: dame(/^Riesgo oficial$/), norma: dame(/^Norma urbana$/),
                   legal: dame(/Información legal del predio/), movilidadReal: dame(/^Movilidad real$/),
                   servicios: dame(/^Servicios públicos$/),
                   potencial: dame(/Potencial edificatorio/), suelo: dame(/Suelo disponible real/),
                   quien: dame(/Quién vive acá/),
                   censo: dame(/Lo que el censo trae además/),
                   tejido: dame(/Continuidad del tejido/),
                   grano: dame(/El grano: manzana y predio/),
                   ciudad: dame(/El sector dentro de la ciudad/),
                   fuera: dame(/Quién queda por fuera/),
                   mueve: dame(/Cómo se mueve el sector/) };
        })(),
        /* §3 (v898) · ¿algún rótulo se pinta DOS veces?
           ────────────────────────────────────────────────────────────────
           Un `<text>` con `stroke` no lleva un contorno: lleva una SEGUNDA
           PASADA DE PINTURA. Medido sobre el PDF de estas mismas dos hojas,
           cada rótulo así salía como dos bloques de texto en la misma
           matriz —uno blanco glifo a glifo y encima el de tinta—, y el
           lector los veía interlineados: «VVeerrddee nnaattuurraall».

           Se persigue la CLASE y no los catorce rótulos que tenía: en toda
           la hoja, ningún nodo de texto puede llevar un trazo que pinte.
           `paint-order` no es la salida —fue lo que había— porque no evita
           la segunda pasada: la ordena. */
        textoConTrazo: [...h.querySelectorAll('svg text')].filter(t => {
          const cs = getComputedStyle(t);
          return cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0;
        }).map(t => (t.textContent || '').slice(0, 24)),
        /* §3 · las cotas del plano del lote, con su caja REAL.
           Con los cincuenta y dos lados que reportó el pliego, las cotas se
           pisaban unas con otras y no se leía ninguna. Se mide el `getBBox`
           de cada una —lo que el navegador dibujó, no lo que se le pidió— y
           se buscan solapes. */
        lote: (function () {
          const sv = h.querySelector('.pcr-plano-lote');
          if (!sv) return null;
          const cot = [...sv.querySelectorAll('text')]
            .filter(t => t.getAttribute('font-size') === '8.5')
            .map(t => { const b = t.getBBox();
              return { t: t.textContent, x1: b.x, x2: b.x + b.width, y1: b.y, y2: b.y + b.height }; });
          let solapes = 0;
          for (let i = 0; i < cot.length; i++) for (let j = i + 1; j < cot.length; j++) {
            const a = cot[i], c = cot[j];
            if (a.x1 < c.x2 && a.x2 > c.x1 && a.y1 < c.y2 && a.y2 > c.y1) solapes++;
          }
          return { cotas: cot.length, solapes,
                   numerados: sv.querySelectorAll('circle[r="3.4"]').length,
                   cuadro: /lados no tienen sitio para su cota/.test(sv.textContent) };
        })(),
        /* Los títulos de las cajas que esta hoja trae. Es lo que permite
           comparar la hoja compuesta con la suelta y exigir que lo que no
           esté, esté DECLARADO fuera. */
        titulos: [...h.querySelectorAll('section.caja h2')].map(x => x.textContent.trim()),
        /* Y la IDENTIDAD de cada una: el `data-m` cuando es un mapa, el
           título cuando no. Una caja de mapa se titula «X · el mapa» y se
           declara fuera por su identificador de mapa (`sombras`), así que
           compararlas por el slug del título no las reconocería — y la
           comprobación diría que un mapa se cayó en silencio cuando está
           declarado con todas las letras. */
        idCajas: [...h.querySelectorAll('section.caja')].map(c =>
          c.getAttribute('data-m') ||
          (c.classList.contains('plano-hero') ? 'plano'
            : ((c.querySelector('h2') || {}).textContent || '').trim())),
        biblio: h.querySelectorAll('.pie .biblio li').length,
        propuestas: h.querySelectorAll('.sintesis-pie .pu').length,
        plano: !!h.querySelector('.plano-hero')
      };
    });
  };
  const leerDoc = async (html) => {
    const pg2 = await ctx.newPage();
    await pg2.setViewportSize({ width: 2268, height: 3402 });
    await pg2.setContent(html || '<i></i>', { waitUntil: 'load' });
    await pg2.waitForTimeout(700);
    const out = await pg2.evaluate(LECTOR);
    await pg2.close();
    return out;
  };
  const M = await m.evaluate(LECTOR);
  /* Las dos hojas SUELTAS, sin ajustar: ahí están todos los paneles, cedan o
     no en la compuesta. */
  const [SA] = await leerDoc(r.soloA);
  const [SB] = await leerDoc(r.soloB);
  const [RA] = await leerDoc(r.refA);
  await m.close();
  await pg.close(); await b.close();
  /* Las dos láminas, guardadas: cuando una comprobación de diagramación
     falla, mirarlas con el navegador dice en un minuto lo que adivinar no
     dice en media hora. */
  try {
    const fs2 = require('fs');
    fs2.writeFileSync(E.TRABAJO + 'lamina-gran.html', r.docGran || '', 'utf8');
    fs2.writeFileSync(E.TRABAJO + 'lamina-gran-pie.html', r.granPie || '', 'utf8');
    fs2.writeFileSync(E.TRABAJO + 'lamina-dos.html', r.doc || '', 'utf8');
    fs2.writeFileSync(E.TRABAJO + 'lamina-solo-a.html', r.soloA || '', 'utf8');
    fs2.writeFileSync(E.TRABAJO + 'lamina-solo-b.html', r.soloB || '', 'utf8');
    fs2.writeFileSync(E.TRABAJO + 'lamina-gran.html', r.granEscala || '', 'utf8');
    fs2.writeFileSync(E.TRABAJO + 'lamina-gran-doc.html', r.docGran || '', 'utf8');
    fs2.writeFileSync(E.TRABAJO + 'lamina-cede.html', r.docCede || '', 'utf8');
    fs2.writeFileSync(E.TRABAJO + 'lamina-pie.html', r.docPieContra || '', 'utf8');
  } catch (e) {}

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

  console.log('\n  -- el pliego son DOS láminas --');
  /* ── §4 · nada se cae en silencio (v901) ─────────────────────────────
     El orden de cesión hace que la hoja compuesta pueda traer menos paneles
     que la suelta: primero cede el texto, después el mapa secundario, y el
     principal de banda al final. Lo que NO puede pasar es que un panel
     desaparezca sin que la ficha lo nombre — la promesa de la v850 es «lo
     que cede se dice por su nombre y entero en el informe en hojas», y sin
     esta comprobación nadie la vigilaba: la suite solo miraba que los
     paneles que le interesaban estuvieran.

     Persigue la CLASE y no un panel: se comparan los títulos de la hoja
     suelta contra los de la compuesta, y cada diferencia tiene que estar en
     `pliegoFuera`. */
  const slug = t => String(t || '').toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const cedidoSinDecir = (suelta, puesta) => (suelta.idCajas || [])
    .filter(id => (puesta.idCajas || []).indexOf(id) === -1)
    .filter(id => (r.fuera || []).indexOf(id) === -1 && (r.fuera || []).indexOf(slug(id)) === -1);
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

  console.log('\n  -- §4 · el orden de cesión, declarado --');
  /* Nada se cae en silencio: lo que la hoja suelta trae y la compuesta no,
     tiene que estar nombrado en `pliegoFuera`. */
  T('ningún panel desaparece de la hoja compuesta sin quedar declarado fuera',
    cedidoSinDecir(RA, A).length === 0 && cedidoSinDecir(SB, B).length === 0,
    cedidoSinDecir(RA, A).concat(cedidoSinDecir(SB, B)).join(' · ') || 'ninguno');
  /* Las once casillas y la banda de coherencia NO ceden nunca: la síntesis
     anuncia once cruces, y publicarla con nueve es mentir por omisión sin
     escribir nada falso. Y con ellas los dos paneles de la lámina A de donde
     salen dos de esas once. */
  const NO_CEDEN = ['Síntesis del sector', 'Coherencia de las cifras'];
  T('la síntesis y la banda de coherencia no ceden en ninguna hoja',
    NO_CEDEN.every(t => (A.titulos || []).concat(B.titulos || []).indexOf(t) >= 0),
    NO_CEDEN.filter(t => (A.titulos || []).concat(B.titulos || []).indexOf(t) < 0).join(' · ') || 'las dos están');
  /* Estos dos ya NO son intocables: la lista de peldaños de la v911 los
     puso en el 3 —últimos en ceder— porque desde la v910 su casilla dice
     SIN MEDIR nombrando el panel ausente, en vez de quedarse sin con qué
     cruzarse. Lo que se sigue exigiendo es que en una hoja que NO cede
     estén puestos: la aserción mide lo mismo, con la razón corregida. */
  T('«Suelo disponible real» y «Potencial edificatorio» están en una hoja que no cede',
    (A.titulos || []).indexOf('Suelo disponible real') >= 0 &&
    (A.titulos || []).indexOf('Potencial edificatorio') >= 0,
    (A.titulos || []).filter(t => /Suelo disponible|Potencial edific/.test(t)).join(' · ') || 'no están');
  /* Y las once, completas: el número de casillas compuestas tiene que ser el
     que la banda anuncia. Es el control de cierre visto desde el papel. */
  T('el cierre imprime las once casillas que la síntesis anuncia',
    (B.crucesDet || []).length === 11, (B.crucesDet || []).length + ' casillas');
  T('y el control de cierre lo confirma, así que la hoja se puede exportar',
    !!r.cierre && r.cierre.ok === true && r.cierre.n === r.cierre.declarados,
    r.cierre ? (r.cierre.n + ' de ' + r.cierre.declarados + (r.cierre.ok ? ' · exporta' : ' · NO exporta')) : 'sin control');
  /* El peldaño 3: un mapa PRINCIPAL de banda no cede mientras haya texto o
     mapa secundario que ceder. Los principales del sector de prueba son la
     foto, el plano y el de todos los usos. */
  T('ningún mapa principal de banda cedió su sitio',
    ['foto', 'plano', 'calor:todos'].every(id => (r.fuera || []).indexOf(id) === -1),
    ['foto', 'plano', 'calor:todos'].filter(id => (r.fuera || []).indexOf(id) >= 0).join(' · ') || 'ninguno');

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

  console.log('\n  -- §1+§2 · quién firma la lámina y qué dice de lejos --');
  /* §1 · los tres datos de identificación. La comprobación es sobre la
     CABECERA impresa y no sobre el estado: lo que hay que garantizar es que
     alguien que descuelga la hoja de una pared sepa de qué sector es, de qué
     proyecto y dónde queda. */
  T('las dos láminas nombran el sector en su tipografía mayor',
    /La Playa/.test(A.h1) && /La Playa/.test(B.h1), A.h1 + ' | ' + B.h1);
  T('y llevan la ubicación administrativa en su propio renglón',
    /Cúcuta/.test(A.ubicAdm) && /Norte de Santander/.test(B.ubicAdm),
    A.ubicAdm);
  T('el proyecto va con la lámina que es',
    /Taller VII/.test(A.eyebrow) && /Lámina A de 2/.test(A.eyebrow) &&
    /Taller VII/.test(B.eyebrow) && /Lámina B de 2/.test(B.eyebrow),
    A.eyebrow);
  /* §2 · UNA cifra, y la de cada hoja es la suya: la A responde por el sitio
     y el terreno, la B por la gente. Si las dos imprimieran la misma, la
     cifra dejaría de resumir la lámina y pasaría a ser un membrete. */
  T('cada lámina abre con UNA cifra grande, y es la suya',
    /área analizada/.test(A.cifraHoja) && /habitantes/.test(B.cifraHoja) &&
    A.cifraHoja.trim() !== B.cifraHoja.trim(),
    A.cifraHoja.trim() + '  ||  ' + B.cifraHoja.trim());
  T('y debajo, la pregunta que abre la lámina',
    /\?/.test(A.responde) && /\?/.test(B.responde), A.responde.slice(0, 70));
  /* La jerarquía del pliego es de TAMAÑO. Se mide en milímetros de papel
     porque es lo que decide a qué distancia se lee cada cosa: el nombre del
     sector a tres metros, la cifra a dos, el pie a treinta centímetros. */
  T('el nombre del sector es lo más grande de la hoja, y la cifra va detrás',
    A.mmH1 > A.mmCifra && A.mmCifra > A.mmPie * 2,
    'sector ' + A.mmH1 + ' mm · cifra ' + A.mmCifra + ' mm · pie ' + A.mmPie + ' mm');

  /* §2 · los tres párrafos de cuerpo pequeño BAJARON al pie. No basta con que
     estén: la petición es que dejen de ocupar la franja que se lee de lejos,
     así que se mira en qué mitad de la hoja está cada uno. */
  const enCab = (h, re) => re.test(h.cabTexto), enPie = (h, re) => re.test(h.pieTexto);
  T('la regla de neutralidad está impresa, y al pie y no en la cabecera',
    enPie(A, /Sin propósito declarado/) && !enCab(A, /Sin propósito declarado/) &&
    enPie(B, /Sin propósito declarado/) && !enCab(B, /Sin propósito declarado/));
  T('el «cómo se lee» también bajó',
    enPie(A, /Cómo se lee/) && !enCab(A, /Cómo se lee/) &&
    enPie(B, /Cómo se lee/) && !enCab(B, /Cómo se lee/),
    A.leeAsi.slice(0, 70));
  T('y el radio con su fecha de corte',
    enPie(A, /fecha de corte/) && !enCab(A, /Radio de análisis/) &&
    enPie(B, /fecha de corte/) && !enCab(B, /Radio de análisis/));

  /* §1 · un campo en blanco se IMPRIME. Es lo contrario de lo que hace un
     formulario: acá el hueco tiene que verse, porque una lámina sin nombre de
     proyecto colgada al lado de otra no se distingue de ella. */
  T('un campo de identificación en blanco sale «SIN NOMBRAR», no en blanco',
    /class="sin-nombrar">SIN NOMBRAR</.test(r.sinProyecto || ''),
    (String(r.sinProyecto || '').match(/<b class="sin-nombrar">[^<]*<\/b>/) || ['—'])[0]);
  /* Y en su propio elemento, que es lo que permite pintarlo de rojo: como
     texto suelto sería una cadena más y se imprimiría igual que el resto. */
  T('y va marcado aparte, para poder verse en rojo',
    /\.sin-nombrar\{[^}]*color:#FF8A7A/.test(r.sinProyecto || ''));
  T('con los tres campos escritos, la hoja no dice SIN NOMBRAR en ninguna parte',
    A.sinNombrar === 0 && B.sinNombrar === 0,
    A.sinNombrar + ' en la A · ' + B.sinNombrar + ' en la B');

  /* §1 · y los tres viajan al nombre del archivo. Veinte PDF en la carpeta de
     descargas de un profesor se distinguen por ahí y por nada más. */
  T('el PDF se baja con el proyecto, el sector y la fecha en el nombre',
    /Taller-VII/.test(r.archivo || '') && /La-Playa/.test(r.archivo || '') &&
    /\d{4}-\d{2}-\d{2}/.test(r.archivo || '') && /60x90\.pdf$/.test(r.archivo || ''),
    r.archivo || '(no se bajó)');

  /* Y la cifra se dice como se escribe en castellano. Persigue la CLASE y no
     el caso: en toda la hoja, ninguna área lleva punto decimal. Se acota a
     una o dos cifras detrás del punto porque un separador de miles siempre
     trae tres —«1.234 ha» son mil doscientas—, así que el patrón no puede
     confundir las dos maneras de escribir un número que conviven en la hoja. */
  const buscar = (h, re) => h.trozos.reduce((a, t) => a.concat(String(t).match(re) || []), []);
  /* (v891) · la guarda de la v885 miraba solo las ÁREAS —«ha» y «km²»— y por
     eso pasó en verde durante seis versiones con catorce cifras de punto
     decimal impresas en el resto de la hoja: los grados de la carta solar
     («85.9° al mediodía»), el porcentaje construido («9.2%»), las personas
     por vivienda, la densidad de usos y el propio chequeo de coherencia
     («panel 6.1 m²/hab»).

     Una guarda acotada a la unidad en la que apareció el defecto solo caza
     la unidad en la que apareció. Ahora persigue la clase entera: **ninguna
     cifra de la hoja lleva punto decimal**, sea cual sea lo que venga
     detrás. El acotado sigue donde tiene que estar —una o dos cifras tras el
     punto, porque un separador de miles siempre trae tres—, y eso también
     deja fuera las direcciones y los dominios, donde tras el punto van
     letras. */
  const PUNTO_DEC = /(?<![\d.,])\d+\.\d{1,2}(?![\d])/g;
  T('ninguna cifra impresa lleva punto decimal en vez de coma',
    !buscar(A, PUNTO_DEC).length && !buscar(B, PUNTO_DEC).length,
    buscar(A, PUNTO_DEC).concat(buscar(B, PUNTO_DEC)).slice(0, 6).join(' · ') || 'ninguna');

  /* Y el separador de miles. Mismo molde: una cifra correcta que no se puede
     leer. Se persigue desde cinco dígitos porque por debajo caben los años,
     los números de decreto y las coordenadas, que se escriben sin punto a
     propósito; de cinco en adelante no hay ninguna cifra de esta hoja que se
     escriba seguida. */
  /* ── §9 (v903) · la hoja habla de USTED ─────────────────────────────
     La v878 sacó el voseo y la v880 le puso una guarda que se defiende sola.
     El TUTEO se quedó: la v897 lo midió, lo declaró «otra familia y otra
     decisión», y lo dejó escrito con su número para que alguien la tomara.
     §9 la toma: «unificar todo en usted».

     Esta guarda va sobre el PAPEL y no sobre los archivos, y por una razón
     que costó una vuelta averiguar: recorriendo el código, «te» y «tu» casan
     dentro de identificadores —`var te = ter.elevacion`— y una guarda con
     esa clase de falso positivo termina con una lista de excepciones que
     envejece hasta no significar nada (la lección de la v895). Sobre los
     nodos de texto de las dos hojas compuestas no hay identificadores: lo
     que está ahí es lo que el jurado lee.

     Las formas van listadas una por una porque no hay regla que las separe:
     «vio» es usted y «viste» es tú, pero también es el pretérito de «vestir»;
     la lista es corta y cada renglón se ve. */
  const TUTEO = [
    /\btu\b/gi, /\btus\b/gi, /\btú\b/gi, /\btuyos?\b/gi, /\btuyas?\b/gi, /\bcontigo\b/gi,
    /\bte\s+(queda|sirve|toca|ahorran?|recomienda|deja|dice|da|pasa)\b/gi,
    /\b(tienes|puedes|quieres|sabes|haces|dices|vienes|pones|sales|debes|necesitas|eres)\b/gi,
    /\b(estás|vas a)\b/gi,
    /\b(mediste|viste|elegiste|dibujaste|marcaste|pusiste|escribiste|hiciste|agregaste|sentiste)\b/gi,
    /\b(llegarás|verás|podrás|tendrás|sabrás|harás|irás|querrás|dirás|pondrás|vendrás|saldrás)\b/gi
  ];
  const tuteoEn = (h) => {
    const out = [];
    TUTEO.forEach(re => { (h.trozos || []).forEach(t => {
      let m; re.lastIndex = 0;
      while ((m = re.exec(t))) out.push(m[0] + ' → «' + t.slice(Math.max(0, m.index - 25), m.index + 35).trim() + '»');
    }); });
    return out;
  };
  T('ninguna de las dos hojas le habla de tú a quien la lee',
    !tuteoEn(A).length && !tuteoEn(B).length,
    tuteoEn(A).concat(tuteoEn(B)).slice(0, 5).join(' · ') || 'ninguna');

  /* ── §10 (v906) · una sola cifra por magnitud en las dos hojas ─────
     «Es el mismo dato contado dos veces en el mismo código». Se persigue la
     CLASE y no el par que el reporte trajo: de cada magnitud, las dos hojas
     no pueden imprimir dos totales distintos. Se lee del papel compuesto, y
     por ANCLA —la frase que rodea la cifra— y no por nodo suelto: en un
     `fila` el rótulo y el valor son dos nodos, así que un número solo no
     dice de qué es.

     Va con su propia guarda de material: si no encuentra al menos dos sitios
     donde la magnitud se cite, no está comprobando nada y lo dice. Es la
     lección de la v886 —una comprobación que pasa por no tener nada que
     rechazar es un verde—.

     El par que §10 nombra sale en `tsinmapear`, cuyo sector sí puede
     producirlo; acá las dos reglas coincidían, así que esto es una GUARDA
     contra que vuelvan a separarse, no una afirmación nueva. */
  const nMil = t => Number(String(t).replace(/\./g, ''));
  /* Se lee sobre los NODOS unidos por un separador que no es un dígito, no
     sobre la tira. Con la tira, un «1» de la caja de al lado se pega al
     «244» del encabezado y sale un 1.244 que nadie imprimió —la lección de
     la v885, encontrada otra vez acá y con el mismo aspecto: una cifra falsa
     que se ve igual de bien que una buena—. El separador va en las anclas
     que cruzan de rótulo a valor, que en un `fila` son dos nodos. */
  const citas = (h, anclas) => {
    const out = [], tira = (h.trozos || []).join(' \u22ee ');
    anclas.forEach(([re, etq]) => {
      const r = new RegExp(re, 'g'); let m;
      while ((m = r.exec(tira))) out.push({ etq, n: nMil(m[1]) });
    });
    return out;
  };
  const ANCLAS_EDIF = [
    ['Se cuentan los[^\\d]{0,8}([\\d.]+)[^\\d]{0,10}edificios que trae', 'la nota de fuente'],
    ['de ([\\d.]+) edificios traen la altura', 'la cobertura de altura'],
    ['Edificios con forma medida[^\\d]{0,8}[\\d.]+ de ([\\d.]+)', 'El grano'],
    ['Edificios con altura registrada[^\\d]{0,8}[\\d.]+ de ([\\d.]+)', 'Potencial edificatorio']
  ];
  const ANCLAS_USOS = [
    ['([\\d.]+)\\s*usos registrados', 'el encabezado'],
    ['de los[^\\d]{0,8}([\\d.]+)[^\\d]{0,8}usos que cuenta el sector', 'Qué hay, por categoría'],
    ['clasificados de los ([\\d.]+) del sector', 'las propuestas']
  ];
  const unaSola = (etq, anclas) => {
    const c = citas(A, anclas).concat(citas(B, anclas));
    const val = [...new Set(c.map(x => x.n))];
    T('las dos hojas citan ' + etq + ' en más de un sitio', c.length >= 2,
      c.length + ' citas: ' + c.map(x => x.etq + ' ' + x.n).join(' · '));
    T('y todas dicen la MISMA cifra, que es lo que §10 pide', val.length === 1,
      val.length === 1 ? String(val[0]) : c.map(x => x.etq + ' ' + x.n).join(' ≠ '));
  };
  console.log('\n  -- §10 · una sola fuente por magnitud --');
  unaSola('los edificios del sector', ANCLAS_EDIF);
  unaSola('los usos del sector', ANCLAS_USOS);
  /* Y el subtotal, que es la otra mitad de §10: cuando la tabla descarta
     registros tiene que decir cuántos y por qué. Sin esto, el arreglo
     podría ser imprimir una sola cifra y callar la diferencia. */
  T('y el reparto por categoría dice cuántos descarta y por qué',
    /Esta tabla suma [\d.]+ de los [\d.]+ usos que cuenta el sector/.test(B.texto) &&
    /(no pudo clasificar en ninguna categor\u00eda|que son todos)/.test(B.texto),
    (/Esta tabla suma[^.]{0,170}/.exec(B.texto) || ['no lo dice'])[0].slice(0, 150));

  const SIN_MILES = /(?<![\d.,])\d{5,}(?![\d.,])/g;
  T('ninguna cifra de cinco dígitos va impresa sin separador de miles',
    !buscar(A, SIN_MILES).length && !buscar(B, SIN_MILES).length,
    buscar(A, SIN_MILES).concat(buscar(B, SIN_MILES)).slice(0, 4).join(' · ') || 'ninguna');

  console.log('\n  -- §21 · los tamaños, comprobados antes de exportar --');
  /* El pliego pide comprobar los mínimos CONTRA la hoja de 60 × 90 antes de
     exportar. Lo que hay que garantizar no es que se cumplan —se miden y se
     ve que en un pliego de veinte mapas no todos llegan— sino que la hoja
     diga cuánto mide de verdad: un mapa chico con su medida escrita se
     discute, y uno sin ella hay que medirlo con una regla sobre el papel. */
  T('las dos láminas imprimen el veredicto de tamaños',
    /Tamaños de impresión comprobados/.test(A.tamanos) &&
    /Tamaños de impresión comprobados/.test(B.tamanos),
    A.tamanos.slice(0, 60));
  T('y dice cuántos mapas midió y cuánto mide el más chico',
    /\d+ mapas medidos/.test(A.tamanos) && /el más chico mide \d+(,\d+)? cm/.test(A.tamanos),
    (A.tamanos.match(/\d+ mapas medidos[^;]*; el más chico mide [\d,]+ cm/) || ['—'])[0]);
  /* Y la cifra que imprime es la que sale de medir los mapas de ESA hoja.
     Un veredicto calculado sobre otra maquetación —la de antes de meterle el
     propio renglón, por ejemplo— sería una cifra correcta de una hoja que no
     es esta, que es la clase de error de la v879. */
  const menorReal = h => Math.min.apply(null, h.ladosMapa.map(x => x.mm));
  const menorDicho = h => {
    const m = /el más chico mide ([\d,]+) cm/.exec(h.tamanos);
    return m ? Number(m[1].replace(',', '.')) * 10 : null;
  };
  T('la medida que imprime es la de los mapas de esa misma hoja',
    Math.abs(menorDicho(A) - menorReal(A)) <= 1 && Math.abs(menorDicho(B) - menorReal(B)) <= 1,
    'A dice ' + menorDicho(A) + ' y mide ' + menorReal(A) +
    ' · B dice ' + menorDicho(B) + ' y mide ' + menorReal(B) + ' mm');
  /* Los dos niveles van SEPARADOS. El de 8 cm es el piso —por debajo un mapa
     no se lee en la pared— y el de 12/10 es el objetivo de reparto de papel.
     Pintarlos igual enseñaría a ignorar el aviso el día que sí haya un mapa
     ilegible, que es como muere una alarma. */
  T('separa el mínimo de 8 cm del objetivo de 12 y 10',
    /mínimo de 8 cm/.test(A.tamanos) && /objetivo del pliego/.test(A.tamanos));
  T('y solo se pinta en rojo cuando algo baja del mínimo, no cuando falta objetivo',
    A.tamanosRojo === (menorReal(A) < 80) && B.tamanosRojo === (menorReal(B) < 80),
    'A ' + (A.tamanosRojo ? 'rojo' : 'negro') + ' con ' + menorReal(A) + ' mm · ' +
    'B ' + (B.tamanosRojo ? 'rojo' : 'negro') + ' con ' + menorReal(B) + ' mm');
  /* Y lo que el pliego no consigue lo dice con el remedio al lado: crecer
     cuesta paneles, y de quién es esa decisión. Sin esa frase, el número es
     un reproche sin salida. */
  T('cuando no alcanza el objetivo, dice qué cuesta alcanzarlo',
    /(alcanzan el objetivo del pliego|objetivo del pliego —)/.test(A.tamanos) &&
    (!/objetivo del pliego —/.test(A.tamanos) || /apagar paneles desde la ficha/.test(A.tamanos)),
    (A.tamanos.match(/para que crezcan[^.]*\./) || ['alcanza el objetivo'])[0]);
  /* El piso histórico, apretado contra lo medido: ningún mapa de esta hoja
     baja de 60 mm. La aserción de `tlaminaedu` decía 45, que es un número
     que este sector deja de tocar por veinte milímetros — y un piso que
     nadie roza no vigila nada. */
  T('ningún mapa de las dos hojas baja de 60 mm de lado menor',
    menorReal(A) >= 60 && menorReal(B) >= 60,
    'A ' + menorReal(A) + ' mm · B ' + menorReal(B) + ' mm');

  console.log('\n  -- el radio y la bibliografía --');
  /* §2 · el alcance sigue impreso en las dos, pero AL PIE: es procedencia
     que alguien va a querer citar, no algo que se lea a tres metros. La
     aserción se apretó al mudarse —antes bastaba con «Radio de» en la
     cabecera; ahora pide además los usos contados y la fecha de consulta,
     que es lo que hace citable una lámina. */
  const alcanceOk = t => /Área dibujada|Radio de análisis/.test(t) &&
                         /usos registrados/.test(t) && /consultado el/.test(t);
  T('las dos llevan el alcance y la fecha de corte, y van al pie',
    alcanceOk(A.alcance) && alcanceOk(B.alcance),
    A.alcance.slice(0, 90));
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
    T('trae los siete de una lámina y los cinco cruzados (§6)', CO.filas.length === 12,
      CO.filas.length + ' chequeos');
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
      sinDato.length >= 3 && sinDato.every(f => /haría falta|no se está leyendo|no consulta|por ciudad|no se pudo|no imprime|ninguna altura|sin llenos|una capa vacía|no hay parques/i.test(f.texto)),
      sinDato.length + ' sin dato · ' + sinDato.map(f => f.texto.slice(0, 44)).join(' | '));
    T('y ninguno se presenta como aprobado sin haberse corrido',
      CO.filas.filter(f => f.estado === 'pasa').every(f => !/sin dato|haría falta/i.test(f.texto)));
  }

  /* ── §6 · los chequeos que CRUZAN las dos láminas ───────────────────────
     La contradicción que llegó impresa no la veía ninguno de los siete: la
     lámina A decía «103 cruces por km², trama continua, en rango caminable»
     y el cierre de la B, con el MISMO nombre, «0 % del frente de la cuadra
     con fachada, frente roto». Las dos cifras eran correctas; lo que estaba
     mal era que se llamaban igual.

     Cada uno de los cinco se mide por lo que IMPRIME —los dos valores, con
     su lámina— y no solo porque exista el renglón: un chequeo cruzado que
     salga sin sus dos cifras no se puede resolver leyéndolo, que es para lo
     único que existe.                                                      */
  console.log('\n  -- §6 · los chequeos cruzan las dos láminas --');
  if (CO) {
    const cruz = CO.filas.filter(f => /las dos láminas|trama y el paramento|cabe dentro del sector/.test(f.texto));
    T('el panel trae los cinco chequeos cruzados', cruz.length === 5,
      cruz.length + ' cruzados · ' + cruz.map(f => f.texto.slice(8, 46)).join(' | '));
    T('y cada uno imprime los DOS valores, no la conclusión sola',
      cruz.every(f => /\(lámina A\)/.test(f.texto)) &&
      cruz.filter(f => /\(lámina B\)/.test(f.texto)).length >= 3,
      cruz.map(f => (/\(lámina A\)/.test(f.texto) ? 'A' : '·') + (/\(lámina B\)/.test(f.texto) ? 'B' : '·')).join(' '));
    T('la cabecera del panel dice que los últimos cruzan las dos hojas',
      /cruzan las DOS láminas/.test(B.texto), (B.texto.match(/cruzan las DOS[^.]{0,60}/) || ['-'])[0]);
    T('y la banda pregunta por las dos, no por «esta lámina»',
      /DOS láminas se contradicen/.test(B.texto) && !/cifras de esta lámina se contradicen/.test(B.texto + A.texto));
    /* El error típico declarado del panel: dar por bueno un chequeo que no
       se pudo correr. Sigue escrito, y con los cruzados es más fácil
       saltárselo —cinco renglones nuevos, cinco maneras de callar—. */
    T('el error típico sigue declarado: dar por bueno lo que no se corrió',
      /dar por bueno un chequeo que no se pudo correr/i.test(B.texto));
  }

  /* Las cuatro divergencias REALES que el §6 destapó, cada una arreglada en
     su sitio. Se comprueban por el resultado impreso y no por el código: es
     lo que un jurado compara cuando pone las dos hojas una al lado de otra. */
  console.log('\n  -- §6 · lo que las dos hojas ya no se contradicen --');
  T('el cierre llama al frente de la cuadra «paramento», no «tejido»',
    /Continuidad del paramento/.test(B.texto) && !/Continuidad del tejido/.test(B.texto),
    (B.texto.match(/Continuidad del [a-zé]+/g) || []).join(' · ') || 'ninguna');
  T('y «Continuidad del tejido» sigue siendo el panel de la A, con sus cruces',
    /Continuidad del tejido/.test(A.texto) && /cruces por km²/.test(A.texto));
  /* Y el rótulo dice la VERDAD de dónde sale: `poblacionEstimada` es la
     proyectada cuando hay DANE, no el conteo censal —que vive aparte—, así
     que llamarla «contada por el censo» sería cambiar una omisión por una
     etiqueta falsa. La comprobación persigue las dos mitades. */
  T('la población de la lámina A dice de dónde sale, así que no choca con la de la B',
    /Población proyectada a \d{4}|Población del censo de \d{4}|Población estimada por densidad/.test(A.texto),
    (A.texto.match(/Población (?:proyectada|del censo|estimada)[^0-9]{0,32}[\d.]+/) || ['-'])[0]);
  T('y no la llama «contada por el censo» si es la proyectada',
    !/Población contada por el censo/.test(A.texto));
  /* §11 (v884): el cierre cita ahora la cascada entera y no la resta del
     agua sola. Es la misma exigencia de la v879 —una sola cuenta para las
     dos hojas— con una cuenta que creció. */
  T('el suelo disponible del cierre cita la cascada, como el panel de la A',
    /Suelo disponible real/.test(B.texto) && /aprovechables tras los descuentos/.test(B.texto),
    (B.texto.match(/Suelo disponible real[^·]{0,70}/) || ['-'])[0]);
  T('y no queda en el cierre el rótulo viejo de «ha brutas»',
    !/ha brutas/.test(B.texto));

  /* ── §14 · los anillos, de ancho constante y en densidad ────────────────
     Los cortes eran [0, 200, 400, 700, radio]: cuatro anchos distintos, y el
     último se comía el resto. Con 2.500 m de radio ese anillo medía 1.800 m y
     salía impreso «400–700 m: 6 usos · 700–2.500 m: 2.637», que no dice nada
     del sector — dice que un anillo tiene veinticinco veces el área del otro.

     El sector de prueba lo demuestra solo: 76 usos en el primer anillo contra
     105 en el segundo, pero 6/ha contra 2,8/ha. Contando, afuera hay más;
     midiendo, adentro hay el doble. Esa inversión es la razón de la tanda, y
     por eso se comprueba y no solo se mira. */
  /* ── §12 · la banda ambiental cierra en decisión de proyecto ──────────
     Quedó a medias: la carta solar estaba, con los dos solsticios y sin el
     equinoccio y sin decir qué curva era cuál; la recomendación de fachada
     era UNA FRASE FIJA que se imprimía igual en cualquier latitud; no había
     nada por orientación; el único estudio de sombra pedía un lote dibujado;
     y la rosa de vientos se quedaba en rosa.

     Se comprueba sobre el PAPEL y no sobre las variables, que es la regla de
     la v879: lo que hay que ver es lo que el lector ve. */
  /* ── §18 · seis plantillas de medición, no tres paneles ───────────────
     La banda de campo traía tres paneles y los tres son de PERCEPCIÓN: qué
     se sintió, qué permanece, qué dice quien vive ahí. El pliego pide seis
     formularios de MEDICIÓN, con su cuadrícula y sus casillas rotuladas.

     La aserción que más vale no es que estén: es que **cada una diga en qué
     panel se pega su resultado**. Sin eso es un anexo —una hoja que se
     llena, se archiva y no cambia nada— y el pliego pidió lo contrario. */
  console.log('\n  -- §18 · las seis plantillas de medición --');
  const cajaB = t => ((r.soloB || '').split('<section class="caja')
    .filter(x => new RegExp('<h2>' + t + '</h2>').test(x))[0] || '');
  const LAS_SEIS = ['Conteo de alturas por manzana', 'Perfil vial acotado',
    'Estado de andenes por tramo', 'Rutas observadas y su frecuencia',
    'Cupo real de equipamientos', 'Actividad en primer piso'];
  const PL = LAS_SEIS.map(t => ({ t: t, html: cajaB(t) }));

  T('las seis plantillas están impresas, no tres',
    PL.every(x => !!x.html), PL.filter(x => !x.html).map(x => x.t).join(' · ') || 'las seis');
  T('cada una dice qué se mide, con qué y cuánto demora',
    PL.every(x => /Qué se mide/.test(x.html) && /Con qué/.test(x.html) && /Cuánto demora/.test(x.html)),
    PL.filter(x => !/Cuánto demora/.test(x.html)).map(x => x.t).join(' · ') || 'las seis');
  /* Lo que separa una plantilla de un anexo. */
  T('y en qué panel de la lámina se pega lo que se traiga',
    PL.every(x => /pl-pega/.test(x.html) && /Dónde se pega/.test(x.html)),
    (PL[1].html.match(/Dónde se pega<\/i><span>([^<]{0,70})/) || ['', 'no lo dice'])[1]);

  T('cada una trae su cuadrícula con las columnas rotuladas',
    PL.every(x => (x.html.match(/<th>[^<]+<\/th>/g) || []).length >= 5),
    PL.map(x => x.t.split(' ')[0] + ':' + (x.html.match(/<th>/g) || []).length).join(' · '));
  /* Y con filas de verdad para escribir: una cuadrícula de una sola fila no
     sirve para recorrer una manzana. */
  T('y filas en blanco suficientes para una salida',
    PL.every(x => (x.html.match(/<tr><td><\/td>/g) || []).length >= 7),
    PL.map(x => x.t.split(' ')[0] + ':' + (x.html.match(/<tr><td><\/td>/g) || []).length).join(' · '));
  T('ninguna casilla viene llena: se imprimen en blanco',
    PL.every(x => {
      const cuerpo = (x.html.match(/<tbody>[\s\S]*?<\/tbody>/) || [''])[0];
      return cuerpo && !/<td>[^<]/.test(cuerpo);
    }));

  T('van en banda propia, con su pregunta',
    /Qué medir en la calle/.test(r.soloB || '') &&
    /¿Qué hay que ir a levantar, con qué se mide/.test(r.soloB || ''),
    (((r.soloB || '').match(/¿Qué hay que ir a levantar[^<]{0,70}/) || ['sin banda']))[0]);
  /* La advertencia que de verdad hace falta: tres de estas seis levantan
     justo lo que la hoja declara faltando, y una plantilla en blanco se
     puede leer como si la carencia ya estuviera resuelta. */
  T('y la banda avisa que una plantilla vacía no mide nada',
    /Una plantilla vacía no mide nada/.test(r.soloB || '') &&
    /siguen abiertas hasta que alguien/.test(r.soloB || ''),
    (((r.soloB || '').match(/Una plantilla vacía[^<]{0,90}/) || ['no lo avisa']))[0]);
  /* Y la otra mitad de lo mismo, medida sobre la hoja: que la carencia que
     la plantilla viene a cerrar SIGA declarada. Si una tanda futura leyera
     el formulario como si fuera la medición, esto se pone rojo. */
  T('la carencia de frecuencia sigue declarada, porque el formulario no la mide',
    /cada cuánto pasan no está en ninguna parte/.test(r.soloB || ''),
    (((r.soloB || '').match(/cada cuánto pasan[^<]{0,80}/) || ['ya no la declara']))[0]);

  /* §20 · la nota de desarrollo que salía impresa en el pliego real. */
  T('ninguna hoja imprime la nota de desarrollo de la bolsa de sueltas',
    !/Mediciones que todavía no tienen banda propia/.test((r.soloA || '') + (r.soloB || '')));
  /* Y la clase, no el caso: una banda nueva sin conclusión propia caería en
     el `default` y la imprimiría otra vez. Se exige que TODA conclusión
     impresa diga algo del contenido de su banda — ninguna puede ser la de
     «no se pudo redactar», que es la que sale cuando revienta. */
  T('y ninguna banda cierra con la conclusión de emergencia',
    !/la conclusión no se pudo redactar/.test((r.soloA || '') + (r.soloB || '')));

  console.log('\n  -- §12 · la banda ambiental cierra en decisión --');
  const cajaDeA = (doc, t) => ((doc || '').split('<section class="caja')
    .filter(x => new RegExp('<h2>' + t + '</h2>').test(x))[0] || '');
  const enLetras = h => (h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const ASOL = cajaDeA(r.soloA, 'Asoleamiento');
  const ASOLT = enLetras(ASOL);
  const SOMB = cajaDeA(r.soloA, 'La sombra de lo construido');
  const SOMBT = enLetras(SOMB);

  /* ── §6 (v903) · el volumen que nadie autorizó ──────────────────────
     El pliego v2 lo trajo impreso de la corrida real: «204.544 m² de sombra»
     sobre «4 pisos sobre 523.161 m² de huella», llamado **el volumen de la
     norma**, en una hoja cuyo panel de norma urbana dice SIN DATO OFICIAL.
     Los 4 pisos son el valor de ejemplo con el que llega la herramienta: una
     cuenta correcta sobre un supuesto inventado, presentada como medición.

     Esta suite mide la rama del VACÍO —su lote es un predio de tres mil
     metros que nadie ha normado, que es el caso de cualquier estudiante el
     primer día—. La rama medida, la del que ya fue a la curaduría, la miden
     `tlaminaedu`, `tpliegogrande` y `tmasanalisis`, que escriben los tres
     índices con los campos de verdad. Las dos hacen falta: sin la primera la
     hoja vuelve a inventarse una norma, y sin la segunda un «no se puede
     calcular» puesto en todas partes pasaría por bueno. */
  console.log('\n  -- §6 · sin índices del POT no hay volumen permitido --');
  const SOMPRO = cajaDeA(r.soloA, 'La sombra que proyecta');
  const somproTxt = enLetras(SOMPRO);
  T('la caja sigue en la hoja: no desaparece, cambia de forma', !!SOMPRO,
    SOMPRO ? somproTxt.slice(0, 70) : 'no está');
  T('y NO imprime un volumen que nadie autorizó',
    !!SOMPRO && !/pisos que permite la norma/.test(somproTxt) && !/m² de sombra fuera del lote/.test(somproTxt),
    (somproTxt.match(/\d+ pisos que permite la norma|[\d.]+ m² de sombra fuera del lote/) || ['no lo imprime'])[0]);
  T('lo dice como vacío, y nombra los tres índices que faltan',
    /Sin dato oficial disponible/.test(somproTxt) &&
    /índices de ocupación y construcción/.test(somproTxt) && /altura máxima/.test(somproTxt),
    (somproTxt.match(/Haría falta[^.]{0,120}/) || ['no lo dice'])[0]);
  T('y se pinta como los otros vacíos, no como una medición',
    /caja-vacio/.test(SOMPRO), /caja-vacio/.test(SOMPRO) ? 'ámbar y a trazos' : 'como si midiera');
  /* La regla de la v880: un vacío que solo nombra lo que falta es un muro.
     Con el trámite y el sustituto declarado es una tarea de una tarde. */
  T('cierra en cómo se consigue, con la curaduría y su término',
    /Cómo se consigue/.test(somproTxt) && /curaduría/.test(somproTxt) && /días hábiles/.test(somproTxt),
    /Cómo se consigue/.test(somproTxt) ? 'con el trámite' : 'nombra el documento y calla el trámite');
  T('y remite a lo que sí se puede leer: la sombra de lo CONSTRUIDO',
    /sombra de lo CONSTRUIDO hoy/.test(somproTxt) && /no de un volumen supuesto/.test(somproTxt),
    (somproTxt.match(/Lo que hay no es eso[^.]{0,90}/) || ['no lo dice'])[0]);
  /* Y el mapa tampoco: una mancha de sombra se mira y se cree, así que
     dejarlo mientras la caja dice que no se puede calcular sería desmentir
     el aviso con la figura de al lado. */
  T('y el mapa de las manchas por hora tampoco se dibuja',
    !/data-m="sombra-proyecto"/.test(r.soloA || ''),
    /data-m="sombra-proyecto"/.test(r.soloA || '') ? 'lo dibuja igual' : 'no se dibuja');
  /* La guarda, contra pasarse de corregir: la sombra de lo CONSTRUIDO —que
     es de la altura medida del sector y no de ninguna norma— tiene que
     seguir imprimiéndose. Es cierto antes y tiene que seguir siéndolo. */
  T('y la sombra de lo construido, que sí está medida, sigue en la hoja',
    !!SOMB && /m/.test(SOMBT), SOMB ? 'sigue' : 'se la llevó por delante');

  console.log('\n  -- §17 · la presión de crecimiento, por sus proxies --');
  /* El pliego lo dijo con esas palabras: «se resolvió con pérdida de
     cobertura verde, que es consecuencia, no presión». El verde que se va
     mide que alguien construyó, no la fuerza que empuja a construir. */
  const PC = cajaDeA(r.soloA, 'Presión de crecimiento');
  const pcTxt = enLetras(PC);
  T('la caja de presión de crecimiento está, y en la lámina A',
    !!PC && !/Presión de crecimiento<\/h2>/.test(String(r.soloB || '')),
    PC ? 'está' : 'no está');
  T('dice que las tres son proxies y no una medición de la presión',
    /proxies/.test(pcTxt) && /[Nn]inguna[^.]{0,60}mide la presión directamente/.test(pcTxt),
    (pcTxt.match(/[Nn]inguna[^.]*mide la presión[^.]*\./) || ['no lo dice'])[0].slice(0, 120));
  /* Y cada uno declara DE QUÉ es proxy, que es la instrucción literal del
     pliego. Sin esa frase los tres se leen como mediciones directas. */
  T('los tres proxies están, cada uno con de qué es proxy',
    /Huella construida/.test(pcTxt) && /Población del municipio/.test(pcTxt) &&
    /Obra pública contratada/.test(pcTxt) &&
    (pcTxt.match(/proxy de/g) || []).length >= 3,
    (pcTxt.match(/proxy de/g) || []).length + ' declaraciones «proxy de»');
  /* La huella construida es el proxy que §17 pide y que YA estaba medido:
     `tendenciaDe` devuelve `duro` desde siempre, al lado del verde que el
     cruce sí usaba. */
  T('la huella construida es el proxy más directo, y se dice',
    /más directo es la huella construida/.test(pcTxt),
    (pcTxt.match(/De los tres[^.]*\./) || ['no lo dice'])[0].slice(0, 110));
  /* La población es del MUNICIPIO y el pliego la pide por comuna: decirlo es
     la diferencia entre un proxy y una suposición sobre este sector. */
  T('la población se declara del municipio, no del sector',
    /municipio entero/.test(pcTxt) && /por comuna/.test(pcTxt),
    (pcTxt.match(/La población es del[^.]*\./) || ['no lo dice'])[0].slice(0, 130));
  /* SECOP es la única de las tres que de verdad falta, y se dice qué haría. */
  T('la obra contratada se declara sin consultar, con qué haría falta',
    /SECOP/.test(pcTxt) && /sin consultar/.test(pcTxt),
    (pcTxt.match(/SECOP[^.]*\./) || ['no lo dice'])[0].slice(0, 110));
  /* Y el verde deja de hacer de indicador de presión: es el cambio de fondo
     que §17 pide, así que se comprueba en el CIERRE, que es donde estaba. */
  /* El cruce del cierre, de la lista que el lector ya saca de la hoja B. */
  const cruPres = (B.cruces.filter(x => /Presión de crecimiento/.test(x))[0] || '');
  T('el cruce del cierre ya no cita el verde como presión',
    !!cruPres && !/verde/.test(cruPres), cruPres || '(sin cruce)');
  /* §1 (v899) · la casilla sin proxy medido ya no imprime una frase donde va
     una cifra: imprime SIN MEDIR, que es lo que §1 pide para toda casilla de
     la síntesis cuyo origen no se pudo medir. Se acepta la rama medida —la
     superficie dura— y la no medida, pero la no medida tiene que ir marcada
     como tal Y nombrar lo que le falta: sin la segunda mitad, bastaría con
     decir «SIN MEDIR» y callar. */
  T('y cita la superficie dura, o dice SIN MEDIR y nombra el proxy que le falta',
    /superficie dura/.test(cruPres) ||
    (/SIN MEDIR/.test(cruPres) && /huella construida|SECOP/.test(cruPres)), cruPres);

  /* Y la rama MEDIDA, con la serie inyectada: es la que §17 pide de verdad
     —la huella construida entre dos fechas de imagen— y la que el sector de
     esta suite no puede producir por su cuenta. */
  const PCS = enLetras(cajaDeA(r.conSerie, 'Presión de crecimiento'));
  T('con la serie leída, la huella construida sale medida y con sus dos fechas',
    /44,1 % → 53,5 %/.test(PCS) && /2014/.test(PCS) && /2024/.test(PCS),
    (PCS.match(/44,1[^·]*·[^·]*/) || ['no la mide'])[0].slice(0, 110));
  T('y la lectura sale de la huella, no del verde',
    /se está llenando/.test(PCS) && !/perdió .* verde/.test(PCS),
    (PCS.match(/El sector[^.]*\./) || ['sin lectura'])[0].slice(0, 120));
  /* El umbral de 3 puntos es el mismo de la serie (js/80) y por debajo no se
     afirma: una diferencia menor cabe en el error de medir dos fotos de años
     y estaciones distintas. */
  T('y declara el límite: por debajo de 3 puntos no se afirma',
    /menor de 3 puntos/.test(PCS), (PCS.match(/menor de 3 puntos[^;]*/) || ['no lo dice'])[0].slice(0, 90));

  /* Y la guarda que esto se ganó a pulso: los cruces del cierre van dentro de
     un `try/catch` que devuelve la lista VACÍA si algo revienta. Al escribir
     esta tanda, un `ReferenceError` dejó la hoja sin los once cruces y sin un
     solo aviso — la suite lo vio por tres aserciones que fallaban lejos de la
     causa. Una lista de cruces vacía es un fallo, no un resultado. */
  /* §1 y §2 (v899) · LO QUE NO SE MIDIÓ Y LO QUE NO CUPO, DICHOS DISTINTO.
     ──────────────────────────────────────────────────────────────────────
     §1 amplía la regla de la v875 a la síntesis: una casilla cuyo origen es
     una capa sin registros o una plantilla sin llenar no puede aparecer con
     cifra. Se persigue la CLASE y no la casilla que el pliego nombró: en
     todo el cierre, una casilla o trae una cifra, o va marcada como no
     medida. Una frase puesta donde va la cifra —«sin trazado medido»— se
     lee, a un palmo de «6,1 m²/hab», como si fuera un valor.

     §2 es la otra mitad, y la causa no era la que el pliego suponía. Los
     chequeos cruzados SÍ leen el papel desde la v879; lo que pasa es que un
     panel que CEDIÓ su sitio no está en ese papel, y el chequeo lo daba por
     no medido. Se reprodujo componiendo la hoja con esos dos paneles
     apagados y salieron las dos frases del reporte, palabra por palabra. */
  console.log('\n  -- §1 · una casilla sin medir no lleva cifra --');
  {
    const cas = [].concat(A.crucesDet || [], B.crucesDet || []);
    T('el cierre trae sus casillas', cas.length >= 8, cas.length + ' casillas');
    /* Una casilla con cifra es la que trae un número en el valor. Sin esto
       la regla se podría cumplir marcando todo como no medido. */
    const conCifra = cas.filter(c => /\d/.test(c.v) && !c.sm);
    const marcadas = cas.filter(c => c.sm);
    const sueltas = cas.filter(c => !c.sm && !/\d/.test(c.v));
    T('las que traen cifra no van marcadas como no medidas',
      conCifra.length >= 5, conCifra.length + ' con cifra');
    T('y ninguna pone una frase donde va la cifra sin marcarse',
      sueltas.length === 0,
      sueltas.map(c => c.k + ': «' + c.v + '»').join(' | ') || 'ninguna');
    /* Y la marca no puede quedarse en un rótulo: la casilla no medida tiene
       que decir CÓMO se llena, que es lo que la vuelve una tarea en vez de
       un muro. Es la decisión de la v880 con el «cómo se consigue». */
    T('y cada casilla no medida dice qué la llena',
      marcadas.every(c => /se calcula sola|se mide con|plantilla de campo|Dibujar|dibujando|se consulta|tabla de proyecciones/.test(c.l)),
      marcadas.map(c => c.k).join(' · ') || 'ninguna marcada en este sector');
  }

  console.log('\n  -- §5 · el pie no se contradice a sí mismo --');
  {
    const pies = (html) => {
      const out = [], re = /<div class="tamanos[^"]*">([\s\S]*?)<\/div>/g;
      let m; while ((m = re.exec(String(html || '')))) {
        out.push(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      }
      return out;
    };
    /* La CLASE, sobre todos los pies que esta suite compone: un pie que
       lista mapas por debajo del piso no puede además afirmar que se
       cumplió. Son la misma cuenta y tiene que dar una sola conclusión. */
    const todos = [].concat(pies(r.doc), pies(r.docPieContra), pies(r.docCede), pies(r.granEscala));
    const contra = todos.filter(t => (/Por debajo del mínimo de 8 cm/.test(t) ||
                                      /no se imprimi(ó|eron) por no llegar a 8 cm/.test(t)) &&
                                     /Todos alcanzan el objetivo/.test(t));
    T('ningún pie nombra un mapa que no llegó al piso y encima dice que cumple',
      contra.length === 0, contra.length ? contra[0].slice(0, 170) : todos.length + ' pies revisados');
    /* Y la rama que lo produce HOY. La del reporte —dieciséis mapas impresos
       por debajo del piso— ya no se puede alcanzar en este sector: el apagado
       de §4 los quita, que es justo lo que §4 pidió. Lo que sí se alcanza es
       la misma contradicción con otra ropa: la hoja dice que apagó un mapa
       por no llegar a 8 cm y dos renglones después que todos alcanzan el
       objetivo. Todos los que quedaron, que no es lo que el lector entiende.

       Se mide en el pie de la lámina A del documento normal, que es donde de
       verdad cae un mapa apagado en este sector. Buscarlo en una composición
       fabricada habría medido otra cosa: si el sector deja de producirlo, la
       aserción lo dice en vez de pasar por no tener material. */
    /* La rama del reporte —dieciséis mapas impresos por debajo del piso— ya
       no se alcanza en la hoja parada, y no por tolerancia: por construcción.
       El reflujo garantiza que ninguna pista baje de 10 cm de ancho, y el
       alto de un mapa al piso de composición del 30 % son 8,25 cm, así que
       el lado menor no puede caer de 8 cm. Medirlo es la manera de saber que
       sigue siendo cierto — si un día un mapa se cae, esta se pone roja. */
    const conQuitados = todos.filter(t => /no se imprimi(ó|eron) por no llegar a 8 cm/.test(t));
    T('ninguna composición tuvo que apagar un mapa por no llegar a los 8 cm',
      conQuitados.length === 0,
      conQuitados.length ? conQuitados[0].slice(0, 150) : todos.length + ' pies, ninguno con mapa apagado');
    /* Y la otra mitad, que hoy pasa sin material y es a propósito: el día
       que una composición sí tenga que apagar uno, su pie no puede decir que
       todos alcanzan el objetivo. Es la misma contradicción de §5 con otra
       ropa, y se deja escrita para que no vuelva por la puerta de atrás. */
    T('y si alguna lo hiciera, su pie diría que la hoja NO cumple',
      conQuitados.every(t =>
        /NO cumple el pliego/.test(t) || /No alcanzan el objetivo del pliego/.test(t)),
      conQuitados.length ? conQuitados[0].slice(-150) : 'guarda sin material: ninguna apagó');
    /* Y la otra mitad, para no arreglarlo borrando la frase: cada pie que
       midió mapas cierra en UNA conclusión y nunca en dos. Las tres son
       excluyentes —cumple, se queda corto del objetivo, no llega al piso— y
       contar cuántas aparecen es lo que impide tanto la contradicción como
       el silencio. */
    const CIERRES = [/Todos alcanzan el objetivo del pliego/,
                     /No alcanzan el objetivo del pliego/,
                     /NO cumple el pliego/];
    const medidos = todos.filter(t => /mapas medidos por su lado menor/.test(t));
    const cuantas = medidos.map(t => CIERRES.filter(re => re.test(t)).length);
    T('y cada pie que midió cierra en una sola conclusión, ni dos ni ninguna',
      medidos.length >= 4 && cuantas.every(n => n === 1),
      medidos.length + ' pies medidos · conclusiones por pie: ' + cuantas.join(', '));
  }

  console.log('\n  -- §2 · un panel que cedió no es un dato que falte --');
  {
    const leerCoh = (html) => {
      const out = [], re = /<li class="coh-([a-z-]+)[^"]*">([\s\S]*?)<\/li>/g;
      let m; while ((m = re.exec(String(html || '')))) {
        out.push({ e: m[1], t: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() });
      }
      return out;
    };
    const cohCede = leerCoh(r.docCede);
    const cohNormal = leerCoh(r.doc);
    const dosDe = (l) => l.filter(x => /suelo disponible es el mismo|altura media construida es la misma/i.test(x.t));
    const ced = dosDe(cohCede), nor = dosDe(cohNormal);
    T('con los dos paneles puestos, los dos chequeos se cruzan',
      nor.length === 2 && nor.every(x => x.e === 'pasa' || x.e === 'contradice'),
      nor.map(x => x.e).join(' · ') || 'no salen');
    T('y con el panel cedido NO dicen «sin dato»',
      ced.length === 2 && ced.every(x => x.e === 'cedio'),
      ced.map(x => x.e).join(' · ') || 'no salen');
    T('sino que nombran el panel que cedió y cómo devolverlo',
      ced.length === 2 && ced.every(x => /cedió su sitio/.test(x.t)) &&
      ced.every(x => /apagar otro panel|imprimir esta hoja suelta/.test(x.t)),
      (ced[0] || { t: '—' }).t.slice(0, 130));
    /* Y la mitad que se puede perder sin darse cuenta: que no se marque como
       «panel fuera» un chequeo que sí se pudo correr. */
    T('y ningún chequeo de la hoja normal se marca como panel fuera',
      cohNormal.filter(x => x.e === 'cedio').length === 0,
      cohNormal.filter(x => x.e === 'cedio').map(x => x.t.slice(0, 40)).join(' | ') || 'ninguno');
  }

  T('el cierre imprime sus cruces: una lista vacía sería un error tragado',
    B.cruces && B.cruces.length >= 8, (B.cruces || []).length + ' cruces');

  const CLIM = enLetras(cajaDeA(r.soloA, 'El clima'));
  const CHOQ = enLetras(cajaDeA(r.choque, 'El clima'));
  const SINRAD = enLetras(cajaDeA(r.sinRad, 'Asoleamiento'));

  T('la carta solar trae el equinoccio, no solo los dos solsticios',
    /equinoccio/i.test(ASOLT) && /Equinoccios .*(marzo|abril|septiembre)/.test(ASOLT),
    (ASOLT.match(/Equinoccios [^A-Z]{0,44}/) || ['no lo trae'])[0]);
  /* Cuatro curvas del mismo gris sin leyenda enseñan que el sol se mueve
     entre dos extremos y no cuál de los dos es junio. De un dibujo del que
     no se sabe qué curva es cuál no sale una fachada. */
  T('y la leyenda dice cuál curva es cuál, con su fecha',
    ['hoy · ', 'sol más alto · ', 'sol más bajo · ', 'equinoccio · ']
      .every(x => ASOLT.indexOf(x) !== -1),
    (ASOLT.match(/hoy · [^A-Z]{0,90}/) || ['sin leyenda'])[0]);

  T('las ocho orientaciones traen sus horas de sol al año',
    ['Norte', 'Nororiente', 'Oriente', 'Suroriente', 'Sur', 'Suroccidente', 'Occidente', 'Noroccidente']
      .every(x => new RegExp(x + '[^|]{0,30}\\d[\\d.]* h').test(ASOLT)) &&
    (ASOLT.match(/\d[\d.]* h/g) || []).length >= 8,
    (ASOLT.match(/Orientación[^.]{0,150}/) || ['sin tabla'])[0]);
  T('y su reparto del directo, que es otra cosa que las horas',
    (ASOLT.match(/\d+ \/ 100/g) || []).length >= 8,
    (ASOLT.match(/\d+ \/ 100/g) || []).join(' · '));
  /* La comprobación que de verdad importa de esta tabla: en el trópico la
     orientación con MÁS HORAS y la que más DIRECTO recibe no son la misma
     —el sur suma más horas y recibe la mitad, porque cuando el sol está al
     sur está alto y roza el plano vertical—. Si las dos etiquetas cayeran en
     la misma fila, la tabla estaría midiendo una cosa dos veces. */
  T('en esta latitud la que más horas suma NO es la que más directo recibe',
    /más horas/.test(ASOLT) && /más directo/.test(ASOLT) &&
    !/(más horas[^|]{0,12}más directo|más directo[^|]{0,12}más horas)/.test(ASOLT),
    (ASOLT.match(/[A-Za-zóí]+ más directo[^A-Z]{0,22}/) || ['-'])[0] + ' | ' +
    (ASOLT.match(/[A-Za-zóí]+ [\d.]+ h más horas[^A-Z]{0,12}/) || ['-'])[0]);
  T('y las dos etiquetas dicen DE QUÉ son, no «la que más» a secas',
    !/la que más<|la que menos</.test(ASOL) && /más directo/.test(ASOLT) && /menos directo/.test(ASOLT));

  T('la radiación medida va al lado, dicha como horizontal y con su fuente',
    /Radiación medida:.*kWh\/m².*horizontal/.test(ASOLT) && /Open-Meteo/.test(ASOLT),
    (ASOLT.match(/Radiación medida:[^.]{0,80}/) || ['no está'])[0]);
  /* Y no multiplicada por la geometría: una es un reanálisis con las nubes
     dentro y la otra el sol sin nubes. Se declara qué haría falta para pasar
     de una a otra en vez de fabricar el producto. */
  T('y la hoja dice que el reparto es geometría, no radiación por fachada',
    /geometría del sol/.test(ASOLT) && /(relativo|relativa)/.test(ASOLT) &&
    /(horaria|IDEAM|meteorológico tipo)/.test(ASOLT),
    (ASOLT.match(/pasarlo a kWh[^.]{0,110}/) || ['no lo declara'])[0]);
  T('si la serie no trajo radiación lo dice, y no calla ni inventa',
    /no vino en la serie/.test(SINRAD) && /geometría del sol/.test(SINRAD),
    (SINRAD.match(/Radiación medida:[^.]{0,70}/) || ['no lo dice'])[0]);

  /* La recomendación DERIVADA. Hasta la v881 era una frase fija que se
     imprimía igual en cualquier latitud sin haberla comprobado. */
  T('la recomendación de fachadas sale de la carta, con las cifras del sitio',
    /La orientación que más sol directo recibe es la <b>/.test(ASOL) &&
    /\(\d+ de 100\)/.test(ASOLT) && /no de una regla general/.test(ASOLT),
    (ASOLT.match(/La orientación que más sol directo[^.]{0,70}/) || ['no la trae'])[0]);
  T('y dice por qué el occidente se protege primero aunque reciba lo mismo que el oriente',
    /no cuestan lo mismo/.test(ASOLT) && /a la tarde/.test(ASOLT));

  T('el estudio de sombra sale de la altura MEDIDA, y de la moda, no de la media',
    !!SOMBT && /la altura que más se repite/.test(SOMBT) && /moda/.test(SOMBT) &&
    /no la media/.test(SOMBT),
    (SOMBT.match(/La altura es la moda[^.]{0,60}/) || ['no está'])[0]);
  T('a dos horas del día, con la altura del sol y hacia dónde cae',
    (SOMBT.match(/\d+:00/g) || []).length >= 2 && /Cae hacia el/.test(SOMBT),
    (SOMBT.match(/Hora Sol Sombra Cae hacia el[^A-Z]{0,80}/) || ['-'])[0]);
  T('y cierra cruzándola con la calzada medida, no en el largo a secas',
    /calzada media de/.test(SOMBT) &&
    /(cruza la calle entera|no alcanza la otra acera)/.test(SOMBT),
    (SOMBT.match(/La sombra (no alcanza|cruza)[^.]{0,60}/) || ['no cierra'])[0]);
  T('declarando el terreno plano y que el reparto depende del rumbo de cada calle',
    /terreno <b>plano<\/b>|terreno plano/.test(SOMBT) && /rumbo de cada calle/.test(SOMBT));

  T('el viento cierra en estrategia: por dónde entra y por dónde sale',
    /Entra por el/.test(CLIM) && /sale por el/.test(CLIM) &&
    /una abertura sola no ventila/.test(CLIM),
    (CLIM.match(/Entra por el[^.]{0,70}/) || ['la rosa se queda sola'])[0]);
  T('y dimensiona las aberturas con la temperatura medida, no en general',
    /°C de media/.test(CLIM) && /(aire cruzado|se puedan)/.test(CLIM));
  T('la rosa declara que está medida a 10 m en campo abierto, no en la manzana',
    /10 m de altura en campo abierto/.test(CLIM) && /medirlo en el sitio/.test(CLIM));
  /* Cuando el aire entra justo por donde más pega el sol, las dos cajas de
     la banda mandan cosas opuestas. Decirlo es el trabajo; que lo descubra
     quien dibuja, no. */
  T('y si el aire entra por donde más pega el sol, la hoja nombra el conflicto',
    /conflicto que decidir/.test(CHOQ) && /entra el aire y la orientación que más sol/.test(CHOQ),
    (CHOQ.match(/conflicto que decidir:[^.]{0,80}/) || ['lo calla'])[0]);
  T('que no sale cuando no lo hay, porque entonces sería un aviso de adorno',
    !/conflicto que decidir/.test(CLIM));

  console.log('\n  -- §14 · los anillos se comparan por densidad --');
  const AL = (A.paneles || {}).alejarse || (B.paneles || {}).alejarse;
  T('el panel de anillos está', !!AL && (AL.barras || []).length >= 2,
    AL ? (AL.barras || []).length + ' anillos' : 'no está');
  if (AL) {
    const anchos = (AL.barras || []).map(b => {
      const m = /^(?:hasta (\d+)|(\d+)[–-](\d+)) m/.exec(b);
      return m ? (m[1] ? Number(m[1]) : Number(m[3]) - Number(m[2])) : null;
    }).filter(x => x != null);
    const agrupados = (AL.barras || []).filter(b => /agrupado/.test(b)).length;
    T('los anillos son de ancho constante, salvo los que se agruparon',
      anchos.length >= 2 &&
      new Set(anchos.filter((_, i) => !/agrupado/.test(AL.barras[i]))).size === 1,
      anchos.join(' · ') + ' m · ' + agrupados + ' agrupado(s)');
    T('y la hoja dice de cuánto es el paso',
      /Anillos de \d+ m/.test(AL.texto), (AL.texto.match(/Anillos de [^.]{0,40}/) || ['no lo dice'])[0]);
    T('cada anillo trae su densidad por hectárea, no solo el conteo',
      (AL.barras || []).every(b => /[\d,]+\/ha/.test(b) && /\d+ usos/.test(b)),
      (AL.barras || []).join(' | '));
    /* La comprobación que de verdad importa: que la barra se DIBUJE por
       densidad. Con el conteo, el segundo anillo del sector de prueba —105
       usos contra 76— saldría más largo que el primero, y el primero tiene
       más del doble de densidad. */
    T('la barra más larga es la del anillo más denso, no la del que más cuenta',
      (function () {
        const dens = (AL.barras || []).map(b => Number((/([\d,]+)\/ha/.exec(b) || [0, '0'])[1].replace(',', '.')));
        const cuenta = (AL.barras || []).map(b => Number((/(\d+) usos/.exec(b) || [0, '0'])[1]));
        const iDens = dens.indexOf(Math.max.apply(null, dens));
        const iCuenta = cuenta.indexOf(Math.max.apply(null, cuenta));
        return iDens !== iCuenta && (AL.anchoBarras || [])[iDens] >= (AL.anchoBarras || [])[iCuenta];
      })(),
      'densidades ' + (AL.barras || []).map(b => (/([\d,]+)\/ha/.exec(b) || ['', '?'])[1]).join('/') +
      ' · anchos ' + (AL.anchoBarras || []).join('/'));
    T('y la conclusión se saca de la densidad, no del conteo',
      /usos por hectárea|densidad es pareja|crece al alejarse/.test(AL.texto),
      (AL.texto.match(/(La actividad|La densidad)[^.]{0,90}/) || ['sin conclusión'])[0]);
    T('el pie explica por qué el conteo sube solo hacia afuera',
      /más área que uno de adentro|contando sube solo/.test(AL.texto));
    if (agrupados) {
      T('y un anillo agrupado dice que lo está, y por qué',
        /menos de 20 usos/.test(AL.texto), (AL.texto.match(/\d+ anillos? tra[ií]an?[^.]{0,70}/) || ['-'])[0]);
    }
  }

  /* ── §19 · un vacío que cierra en tarea, no en ausencia ────────────────
     Hasta la v879 estos paneles terminaban en «sin dato oficial», qué haría
     falta y por qué lo que hay no es eso. Todo cierto y todo inútil para
     quien tiene que ir a buscarlo: nombrar el documento y callar el trámite
     convierte un vacío en un muro. Se comprueba que los cuatro cierren con
     los seis renglones, y que el «mientras llega» diga con qué advertencia
     —un sustituto sin su límite escrito es un permiso para suponer—. */
  console.log('\n  -- §19 · los vacíos cierran en cómo se consigue --');
  /* Los cuatro van en la banda del trabajo de campo, que es de la lámina B:
     son datos por CONSEGUIR, no mediciones del sitio. Se buscan en las dos
     hojas igual, para que un cambio de banda no haga pasar la comprobación
     por no encontrar nada. */
  const conTramite = ['riesgo', 'norma', 'legal', 'movilidadReal']
    .map(k => Object.assign({ k: k }, (A.paneles || {})[k] || (B.paneles || {})[k] || null))
    .filter(x => x.texto);
  T('los cuatro vacíos obligatorios traen su bloque «cómo se consigue»',
    conTramite.length === 4 && conTramite.every(v => (v.tramite || []).length === 6),
    conTramite.map(v => v.k + ':' + (v.tramite || []).length).join(' · ') || 'ninguno');
  T('y cada uno dice ante quién, cómo se radica, qué llevar y cuánto tarda',
    conTramite.length === 4 && conTramite.every(v => {
      const e = (v.tramite || []).map(x => x.etq).join('|');
      return /Ante quién/.test(e) && /Cómo/.test(e) && /Qué hay que llevar/.test(e) && /Cuánto tarda/.test(e);
    }),
    ((conTramite[0] || {}).tramite || []).map(x => x.etq).join(' · ') || 'sin trámite');
  T('el «mientras llega» nombra un sustituto Y su límite, no un permiso para suponer',
    conTramite.length === 4 && conTramite.every(v => {
      const m = (v.tramite || []).filter(x => /Mientras/.test(x.etq))[0];
      /* Un sustituto SIN su límite escrito es un permiso para suponer, que
         es exactamente lo que el resto del módulo prohíbe. Las cuatro
         maneras de acotarlo en castellano —«no», «nunca», «sin», «solo»—
         valen; lo que no vale es nombrar el sustituto a secas. */
      return m && m.val.length > 40 && /\b(no|nunca|sin|solo|s[óo]lo)\b/i.test(m.val);
    }),
    conTramite.map(v => ((v.tramite || []).filter(x => /Mientras/.test(x.etq))[0] || { val: '—' }).val.slice(0, 46)).join(' | '));
  T('ningún trámite deja un renglón en blanco',
    conTramite.every(v => (v.tramite || []).every(x => x.val && x.val.length >= 8)));

  /* Servicios públicos SALE de los vacíos: el censo por manzana lo trae. */
  console.log('\n  -- §19 · servicios públicos se llena con el censo --');
  const SP = (A.paneles || {}).servicios || (B.paneles || {}).servicios;
  T('servicios públicos ya no dice «sin dato oficial disponible»',
    !!SP && !/Sin dato oficial disponible/.test(SP.texto),
    SP ? (SP.vacios || []).join(' · ') || '(sin rótulo ámbar)' : 'el panel no está');
  const spTxt = (A.texto + ' ' + B.texto);
  T('imprime la cobertura por manzana del censo, con su fuente',
    /CNPV 2018/.test(spTxt) && /(Acueducto|Alcantarillado|Energía)/.test(spTxt),
    (spTxt.match(/Acueducto[^A-Z]{0,30}/) || ['no aparece'])[0]);
  T('y dice que es cobertura declarada, no continuidad ni calidad',
    /no continuidad ni calidad/.test(spTxt) && /seis horas al día/.test(spTxt));
  T('la etiqueta de un campo sin alias sale legible, no con el nombre crudo',
    /Gas natural/i.test(spTxt) && !/GAS_NATURAL_SI/.test(spTxt.replace(/\(.*?\)/g, '')),
    (spTxt.match(/[Gg]as natural[^·]{0,24}/) || ['no aparece'])[0]);
  T('y el bloque no se repite en «Lo que el censo trae además»',
    (spTxt.match(/Acueducto/g) || []).length <= 2,
    (spTxt.match(/Acueducto/g) || []).length + ' veces');

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
    /* §3 (v887) · la aserción se dio vuelta. Exigía que los cuatro marcos
       de fuera fueran rectángulos a trazos —la manera de decir «esto no es
       el límite de nadie»— y el pliego lo prohibió: «nunca imprimir un
       marco vacío con la palabra esquemático». Lo que tiene que fallar ahora
       es justo lo que antes tenía que pasar. */
    T('ninguna casilla se queda vacía: las cinco llevan su figura',
      EL.conFigura === EL.marcos, EL.conFigura + ' con figura de ' + EL.marcos);
    T('y ningún marco va ya a trazos, que era la forma de decir que no medía',
      EL.aTrazos === 0, EL.aTrazos + ' a trazos');
    T('y el último lleva el trazo real del área analizada',
      EL.ultimoReal === true);
    /* La advertencia no es un detalle de estilo: pintar un contorno
       inventado sin decirlo es presentar una suposición como un dato, que
       es justo lo que el pliego prohíbe. */
    /* Y el salto de escala se lee EN NÚMEROS: cada casilla imprime su
       superficie, calculada sobre el mismo contorno que dibuja. Sin eso son
       cinco siluetas bonitas de las que no se saca cuánto es cada salto. */
    T('cada casilla con contorno propio imprime su superficie',
      EL.areas.filter(x => /(km²|ha)/.test(x)).length >= 3,
      EL.areas.join(' · '));
    /* Y la que dibuja prestado NO imprime área. Salió midiendo el papel: las
       casillas de municipio y comuna dibujan el departamento porque no se
       descarga su borde, y debajo salían sus 22.140 km² bajo el rótulo
       «Municipio». Una cifra correcta de otra cosa, que es la clase de error
       de la v879 metida en una casilla de quince milímetros. */
    T('y la que ubica sin contorno no imprime un área que no es la suya',
      new Set(EL.areas.filter(x => /(km²|ha)/.test(x))).size ===
        EL.areas.filter(x => /(km²|ha)/.test(x)).length,
      EL.areas.map(x => x || '—').join(' · '));
    /* El país y el departamento son contornos REALES y hay que decir de
       dónde salen y con qué simplificación: un contorno simplificado sigue
       siendo aproximado, y callarlo dejaría leerlo como un límite legal. */
    T('la hoja dice que el contorno del país y del departamento son los reales, y su fuente',
      /contorno del país y el del departamento son los <?b?>?reales/i.test(EL.texto.replace(/\s+/g, ' ')) ||
      (/son los reales/.test(EL.texto) && /Natural Earth/.test(EL.texto)),
      (EL.texto.match(/El contorno[^.]*\./) || ['no lo dice'])[0].slice(0, 150));
    T('y declara la simplificación en vez de dejarla leer como un límite legal',
      /simplificad/.test(EL.texto) && /no son un límite legal/.test(EL.texto),
      (EL.texto.match(/simplificados a [^:]*/) || ['no lo dice'])[0].slice(0, 90));
    /* Lo que se ubica sin contorno se dice por su nombre. Es la otra mitad
       de §3: dibujar de verdad lo que se tiene y nombrar lo que no. */
    T('el municipio y la comuna se declaran como ubicación, no como contorno',
      /ubica, no delimita/.test(EL.texto) && /municipio/.test(EL.texto) && /comuna/.test(EL.texto),
      (EL.texto.match(/La casilla de[^.]*\./) || ['no lo dice'])[0].slice(0, 140));
    /* Y la palabra prohibida no vuelve. Persigue la CLASE: no es que esa
       frase concreta desapareciera, es que la caja no puede volver a
       presentar un marco como esquemático. */
    T('y en ninguna parte de la caja vuelve la palabra «esquemático»',
      !/esquemátic/i.test(EL.texto),
      (EL.texto.match(/esquemátic\w*/i) || ['ninguna'])[0]);
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
    /* Se busca por su RÓTULO y no por su posición. Con la v880 el panel pasó
       de dos cifras a cuatro baldosas —media, moda, mediana y máximo— y
       `slice(0, 2)` medía lo que cayera primero en vez de lo que dice medir;
       la moda es una etiqueta de cajón («Más de 3 niveles»), no un número, y
       la comprobación la habría denunciado por serlo. Más precisa, no más
       laxa: la media y el máximo siguen teniendo que ser cifras. */
    const kpiDe = re => (PT.kpis.filter(x => re.test(x.r))[0] || { v: '' }).v;
    T('la media y el más alto son cifras, no una raya',
      /^[\d.,]+$/.test(kpiDe(/pisos de media/)) && /^[\d.,]+$/.test(kpiDe(/el más alto/)),
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
  /* ── §10 · el potencial edificatorio deja de estar vacío ───────────────
     El pliego lo llamó por su nombre: la norma no se consigue sin radicarla,
     pero lo construido SÍ está medido y es lo que un jurado puede discutir.
     Una media sola no lo cuenta —con la mayoría en un piso y unas torres
     sueltas describe un sector que no existe—, así que van la moda y la
     mediana, y el reparto entero. */
  console.log('\n  -- §10 · el potencial se mide con lo construido --');
  if (PT) {
    T('además de la media, imprime la moda y la mediana',
      /lo que más se repite/.test(PT.texto) && /parte el sector en dos/.test(PT.texto),
      PT.kpis.map(x => x.v + ' ' + x.r).join(' · '));
    /* Y el sector de prueba tiene que poder DEMOSTRARLO: con las alturas
       repartidas parejo, moda y mediana dan lo mismo que la media y el panel
       pasa sin enseñar para qué existe. Es la quinta vez que este proyecto se
       tropieza con un material de prueba demasiado bueno (v862, v866, v874,
       v877). Se fija acá para que no vuelva a degenerar en silencio. */
    T('y el sector de prueba distingue moda de media, que es de lo que trata el panel',
      /1 nivel/.test((PT.kpis.filter(x => /más se repite/.test(x.r))[0] || {}).v || '') &&
      Number(((PT.kpis.filter(x => /pisos de media/.test(x.r))[0] || {}).v || '0').replace(',', '.')) > 1.4,
      PT.kpis.map(x => x.v + ' ' + x.r).join(' · '));
    T('y el reparto de alturas entero, con su porcentaje',
      (PT.barras || []).length >= 2 && (PT.barras || []).every(b => /%/.test(b)),
      (PT.barras || []).join(' | ') || 'sin barras');
    T('declara qué parte del sector no tiene altura registrada',
      /sin dato de altura el|Edificios con altura registrada/.test(PT.texto),
      (PT.texto.match(/Edificios con altura registrada[^A-Z]{0,52}/) || ['no lo dice'])[0]);
    T('y lleva la frase que impide leerlo como norma',
      /Esto es lo que hay construido, no lo que la norma permite/.test(PT.texto) &&
      /se solicita en la curaduría urbana/.test(PT.texto));
  }


  if (SU) {
    /* §11 · la cascada, con sus tres descuentos y los cuatro números a la
       vista. Un solo «95,5 % libre» no se puede discutir; cuatro renglones
       con lo que se le restó a cada paso, sí. */
    T('el suelo disponible sale en cascada, de lo sin construir al aprovechable',
      /Suelo sin construir/.test(SU.texto) && /Aprovechable estimado/.test(SU.texto) &&
      SU.casc.length >= 4,
      SU.casc.map(x => x.t + ' ' + x.m).join(' · ') || 'sin cascada');
    /* Los dos descuentos que el panel declaraba imposibles y no lo eran: la
       pendiente sale del modelo de elevación por celda, que existe, y la
       franja de ronda del recorrido de los cauces, que llega con `out geom`. */
    T('cada descuento dice de dónde sale, que es lo que permite discutirlo',
      SU.casc.filter(x => x.resta).length >= 2 &&
      SU.casc.filter(x => x.resta).every(x => x.de && x.de.length >= 12),
      SU.casc.filter(x => x.resta).map(x => x.t.split(' ')[0] + '←' + (x.de || 'SIN ORIGEN').slice(0, 26)).join(' · '));
    T('la franja de los cauces sale del largo mapeado, no de un conteo de puntos',
      SU.casc.some(x => /^Franja de \d+ m/.test(x.t) && /m de cauce en \d+ tramo/.test(x.de)),
      (SU.casc.filter(x => /^Franja/.test(x.t))[0] || { de: 'no está' }).de);
    T('y la superficie de vía, de los metros de calzada por su ancho medio',
      SU.casc.some(x => /^Superficie de vía/.test(x.t) && /m de calzada a [\d,]+ m de ancho/.test(x.de)),
      (SU.casc.filter(x => /^Superficie de vía/.test(x.t))[0] || { de: 'no está' }).de);
    /* Sin terreno medido el descuento de pendiente NO se puede hacer, y el
       panel lo declara en vez de omitir el renglón: una cascada a la que le
       falta una resta sin decirlo parece completa. */
    T('sin terreno medido, la pendiente se declara y no se omite en silencio',
      !SU.casc.some(x => /^Pendiente sobre/.test(x.t)) &&
      SU.falta.some(x => /pendiente no urbanizable/i.test(x) && /no se ha medido/.test(x)),
      SU.falta.map(x => x.slice(0, 40)).join(' | '));
    /* Y con el terreno medido entra sola, con el umbral impreso. El modelo
       de elevación por celda EXISTE —`analizarTerreno` clasifica nodo por
       nodo—, así que la carencia que el panel declaraba era falsa. */
    const SUT = (((r.conTerreno || '').split('<section class="caja')
      .filter(x => /<h2>Suelo disponible real<\/h2>/.test(x))[0]) || '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    T('con el terreno medido, la pendiente entra en la cascada con su umbral',
      /Pendiente sobre 30 %/.test(SUT) && /12 % de los nodos del modelo de elevación/.test(SUT),
      (SUT.match(/Pendiente sobre[^−]{0,60}/) || ['no entra'])[0]);
    T('y el umbral va dicho como el de la herramienta, no como el del POT',
      /umbral de 30 % es el de esta herramienta, no el del POT/.test(SU.texto));
    /* La frase que el pliego pide casi literal. El ancho de la franja es un
       supuesto y confundirlo con una norma es lo que convierte un tanteo en
       una cifra que alguien alega. */
    T('y la ronda declarada como estimación de trabajo, no como norma',
      /la define el POMCA/.test(SU.texto) &&
      /los 30 m son una estimación de trabajo, no un dato normativo/.test(SU.texto),
      (SU.texto.match(/ronda hídrica oficial[^.]{0,90}/) || ['no lo declara'])[0]);
    /* Y los dos supuestos que cambian el resultado: el reparto proporcional
       y el solape. Sin ellos la cifra se lee como una medición. */
    T('los supuestos van dichos: reparto proporcional y descuentos que se solapan',
      /en proporción/.test(SU.texto) && /solapar/.test(SU.texto) &&
      /resta de más y no de menos/.test(SU.texto),
      (SU.texto.match(/se pueden solapar[^.]{0,80}/) || ['no los dice'])[0]);
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
    /* Lo que sigue sin poder descontarse se dice, y con su fuente. La
       amenaza es la única de las cuatro que no tiene con qué medirse acá:
       lo que hay es susceptibilidad por pendiente, que es un insumo del
       riesgo y no el riesgo. */
    T('y lo que sigue sin poder descontarse va dicho, con su fuente',
      SU.vacios.some(x => /NO se pud/.test(x)) &&
      SU.falta.some(x => /amenaza/i.test(x) && /mapa oficial de riesgo/i.test(x)),
      SU.falta.map(x => x.slice(0, 46)).join(' | ') || 'no lo dice');
    T('sin confundir la susceptibilidad por pendiente con el riesgo',
      SU.falta.some(x => /insumo del riesgo y no el riesgo/.test(x)));
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
      CD.falta.length >= 2 && CD.falta.every(x => /[Hh]aría falta/.test(x)),
      CD.falta.map(x => x.slice(0, 38)).join(' | '));
    /* Hasta la v875 estas dos líneas exigían que la hoja declarara faltando
       «la estructura de edades» y «la densidad de la ciudad». La v876 las
       MIDE —el mismo censo por manzana, corrido sobre el municipio entero en
       una sola consulta— así que la comprobación se da vuelta: ahora lo que
       tiene que fallar es declararlas ausentes. Es la clase de la v864 otra
       vez, y por eso el par correspondiente entra en `PARES` más abajo. */
    T('la pirámide del sector va SOBREPUESTA a la de la ciudad, no aparte',
      /Pirámide del sector sobre la de/.test(CD.texto) && /Barra azul: el sector/.test(CD.texto),
      (CD.texto.match(/Pirámide del sector[^.]{0,60}/) || ['no la sobrepone'])[0]);
    T('y cada cifra se imprime como par sector · ciudad · diferencia',
      CD.pares.length >= 3 && CD.pares.some(x => /hab\/ha/.test(x)) &&
      CD.pares.some(x => /pp$|pp\b/.test(x)),
      CD.pares.slice(0, 3).join(' | ').slice(0, 150));
    /* La diferencia entre dos porcentajes va en PUNTOS porcentuales y la de
       dos magnitudes en porcentaje relativo: «12 % contra 8 %» es +4 pp, no
       +50 %, y confundirlas es de los errores que nadie revisa dos veces. */
    T('y distingue puntos porcentuales de diferencia relativa',
      /puntos porcentuales/.test(CD.texto) && /no se dividen/.test(CD.texto),
      (CD.texto.match(/son puntos porcentuales[^.]{0,60}/) || ['no lo distingue'])[0]);
    T('ya no declara faltando la pirámide ni la densidad de la ciudad',
      !/estructura de edades de la ciudad/i.test(CD.falta.join(' ')) &&
      !/La densidad de la ciudad/.test(CD.falta.join(' ')),
      CD.falta.map(x => x.slice(0, 44)).join(' | ') || 'no declara nada');
    /* Y lo que de verdad sigue faltando sí se declara: son de OTRA fuente
       —OpenStreetMap sobre el municipio entero— y por eso no vienen con la
       columna de la derecha. */
    /* §11 (v902): eran un solo renglón para tres cosas, y las tres no piden
       lo mismo. Dos las resuelve la corrida municipal —que es un botón de
       esta ficha— y la tercera pide una consulta DISTINTA, de polígonos, que
       es justo la que la consulta suelta a escala municipal. Un renglón que
       las siguiera pidiendo juntas mandaría a correr algo que no resuelve una
       de las tres. Se exige que estén separadas Y que cada una diga lo suyo:
       más preciso que antes, no más laxo. */
    const faltaTxt = CD.falta.join(' ');
    T('la corrida municipal se pide por su nombre, y para lo que sí resuelve',
      /[Dd]ensidad de usos y cobertura de equipamientos de la ciudad/.test(faltaTxt) &&
      /análisis de OpenStreetMap sobre el municipio/.test(faltaTxt),
      (faltaTxt.match(/[Dd]ensidad de usos y cobertura[^.]{0,80}/) || ['no lo pide'])[0]);
    T('y el espacio público va aparte, porque pide otra consulta',
      /El espacio público de la ciudad/.test(faltaTxt) &&
      /consulta aparte[^.]*parques y plazas con su geometría/.test(faltaTxt) &&
      !/Espacio público, densidad de usos y cobertura/.test(faltaTxt),
      (faltaTxt.match(/El espacio público de la ciudad[^.]{0,90}/) || ['sigue en el renglón de las tres'])[0]);
  }
  /* Y la escala: es una cifra de MUNICIPIO impresa al lado de las del
     sector, que es exactamente el error que la tabla de escalas evita. */
  /* Sobre la hoja B SUELTA: el rótulo de escala es una propiedad del panel,
     no de la composición, y desde la v901 un panel de la banda de movilidad
     puede haber cedido su sitio en la compuesta (el orden de cesión pone el
     texto de primero). Que ceda o no se comprueba aparte —y que se declare
     al ceder, también—; lo que dice cuando está se comprueba donde está. */
  const escalaB = t => (SB.escalas.filter(x => x.t === t)[0] || {}).e || 'no está';
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
  const MV = (SB.paneles || {}).mueve;
  T('el panel está, y en la banda de movilidad de la lámina B',
    !!MV && /banda-movilidad/.test((MV || {}).banda || '') && !(SA.paneles || {}).mueve,
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
      niega: t => /(el )?estrato[^.]{0,40}(sin dato|no se conoce|no lo trae)/i.test(t) },
    /* §9 (v876): la pirámide y la densidad DE LA CIUDAD. Eran dos de las
       tres carencias que el panel declaraba, y se midieron corriendo el mismo
       censo por manzana sobre el municipio entero. El par va acá por la regla
       de la v864 —una tanda que mide algo que se declaraba faltante agrega su
       par—, que es justo lo que la v865 se saltó. */
    { que: 'la pirámide de la ciudad, sobrepuesta a la del sector',
      mide: t => /Pirámide del sector sobre la de/.test(t),
      niega: t => /(estructura de edades|pirámide)[^.]{0,60}de la ciudad[^.]{0,60}(haría falta|no|falta)/i.test(t) ||
                  /CNPV 2018 agregado por municipio/.test(t) },
    { que: 'la densidad de la ciudad',
      mide: t => /hab\/ha<\/b>\s*<b class="par-c">|par-c">[\d.,]+ hab\/ha/.test(t) ||
                 /Densidad[^<]*<\/i><b class="par-s">/.test(t),
      niega: t => /La densidad de la ciudad\.<\/b>/.test(t) },
    /* §12 (v882). Los tres pares de la banda ambiental, por la misma regla
       de la v864: una tanda que mide algo que antes se daba por ausente
       agrega su par acá, y es más barato que volver a encontrarlo leyendo.

       El de la sombra es el que más falta hacía: el módulo tenía DOS
       estudios de sombra y los dos piden algo que no siempre está —un lote
       dibujado, una norma—, así que era fácil que una tanda posterior
       escribiera «la sombra del sector no se mide» sin mirar que ya se
       mide. */
    { que: 'lo que recibe cada orientación',
      mide: t => /Directo que recibe/.test(t) && /Horas de sol al año/.test(t),
      niega: t => /(horas de sol|radiación)[^.]{0,60}por orientación[^.]{0,60}(no se|haría falta|falta)/i.test(t) ||
                  /sin (cálculo|dato) de orientación/i.test(t) },
    { que: 'la sombra de la altura construida del sector',
      mide: t => /La sombra de lo construido/.test(t),
      niega: t => /sombra[^.]{0,70}(solo|únicamente) (con|si hay) (el )?lote/i.test(t) ||
                  /la sombra del sector no se (mide|calcula)/i.test(t) },
    { que: 'la estrategia de ventilación, no la rosa sola',
      mide: t => /Entra por el/.test(t) && /sale por el/.test(t),
      niega: t => /(la rosa|el viento)[^.]{0,70}no (dice|cierra)[^.]{0,50}(estrategia|aberturas)/i.test(t) }
  ];
  const textoB = (r.soloB || '') + (r.soloA || '');
  const plano = textoB.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  PARES.forEach(p => {
    const lo = p.mide(plano);
    T('si la hoja mide ' + p.que + ', ningún texto suyo la da por ausente',
      !lo || !p.niega(plano),
      lo ? (p.niega(plano) ? 'LA MIDE Y LA NIEGA' : 'la mide, y no la niega') : 'no la mide en este sector');
  });

  console.log('\n  -- una cita no sobrevive al panel que la sostiene (v910) --');
  /* §1 del pliego v2, tercera entrega. La banda de la serie temporal cedió
     y la síntesis siguió citándola: «2,6 puntos de superficie dura entre
     2014 y 2026» con las fotos ya fuera de la hoja. La cifra era CIERTA —la
     serie se midió— y la hoja no la sostenía: quien la lee no tiene con qué
     comprobarla. Es la otra mitad de lo que la v901 dejó a medias: declaró
     el panel ausente en el pie y dejó viva la cita. */
  const casillaDe = (html, etq) => {
    const re = new RegExp('<i class="cv-k">' + etq + '<\\/i><b class="cv-v">([^<]*)<\\/b>');
    const m = re.exec(String(html || ''));
    return m ? m[1] : null;
  };
  const ENT = r.serieEntera || '', CED = r.serieCedida || '';
  /* Primero la guarda de MATERIAL: sin la serie medida esta comprobación no
     tiene nada que rechazar, y pasaría en verde sin comprobar nada. */
  T('con la banda puesta, las dos casillas de la serie citan sus años',
    /2014/.test(casillaDe(ENT, 'Horizonte temporal') || '') &&
    !/SIN MEDIR/.test(casillaDe(ENT, 'Presión de crecimiento') || 'SIN MEDIR'),
    'horizonte «' + (casillaDe(ENT, 'Horizonte temporal') || '(no está)') + '» · presión «' +
      (casillaDe(ENT, 'Presión de crecimiento') || '(no está)') + '»');
  T('con la banda cedida, ninguna casilla sigue afirmando sobre ella',
    !/2014/.test(casillaDe(CED, 'Horizonte temporal') || '') &&
    !/2014/.test(casillaDe(CED, 'Presión de crecimiento') || ''),
    'horizonte «' + (casillaDe(CED, 'Horizonte temporal') || '(no está)') + '» · presión «' +
      (casillaDe(CED, 'Presión de crecimiento') || '(no está)') + '»');
  /* Y no basta con callar: la casilla tiene que decir que el dato ESTÁ
     medido y que lo único que falta es papel, o quien lee sale a levantar
     una serie que ya tiene. Es la distinción de la v899 entre «sin dato» y
     «el panel cedió», dicha ahora en la síntesis. */
  const lCed = (function () {
    const m = /<i class="cv-k">Horizonte temporal<\/i><b class="cv-v">[^<]*<\/b><small class="cv-l">([^<]*)<\/small>/.exec(CED);
    return m ? m[1] : '';
  })();
  T('y dice que la cifra está medida y que el panel cedió, con su remedio',
    /est[áa] medida/i.test(lCed) && /cedi[óo] su sitio/i.test(lCed) && /Cómo cambió el sitio/.test(lCed),
    lCed ? '«' + lCed.slice(0, 120) + '…»' : 'sin lectura');
  /* La bibliografía es el otro sitio donde la hoja CITA, y citaba la fuente
     de una banda que no estaba. */
  T('la bibliografía deja de citar la fuente de la banda que cedió',
    r.bibEntera && !r.bibCedida,
    'con la banda: ' + (r.bibEntera ? 'la cita' : 'NO la cita') +
      ' · sin la banda: ' + (r.bibCedida ? 'LA SIGUE CITANDO' : 'no la cita'));

  console.log('\n  -- la ubicación escrita a mano llega a las escalas (v910) --');
  /* §4 del pliego v2. La v904 dijo que conectaba el campo de ubicación
     administrativa con la casilla de la comuna, y **no lo conectó nunca**:
     leía `escrito.valor` y `identidadDe` devuelve `{ t, falta }`. `partes`
     salía vacío, no llegaba nunca a dos y la función devolvía el
     geocodificador tal cual, así que el panel siguió imprimiendo «Sin
     nombre en el geocodificador: Comuna» con la ubicación escrita dos
     pantallas antes. Es la regla de la v863 en su forma más barata de
     evitar: el nombre del campo se lee de la función.

     Esta suite escribe «Comuna 1, Cúcuta, Norte de Santander» en el campo,
     así que el material está desde la v885. */
  const cajaEsc = (function () {
    const i = String(r.doc || '').indexOf('<h2>Dónde queda, escala por escala</h2>');
    if (i < 0) return '';
    const j = String(r.doc).indexOf('<section class="caja', i);
    return String(r.doc).slice(i, j < 0 ? undefined : j).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  })();
  T('la casilla de la comuna toma lo que se escribió en la ficha',
    !!cajaEsc && !/Sin nombre en el geocodificador[^.]*Comuna/.test(cajaEsc),
    cajaEsc ? (cajaEsc.match(/Sin nombre en el geocodificador[^.]{0,60}/) || ['ninguna casilla sin nombre'])[0] : 'no sale la caja');
  /* Y lo declara: un nombre tecleado y uno consultado se ven igual
     impresos, y esta hoja no presenta lo uno como lo otro (v867). */
  T('y declara que ese nombre lo escribió quien analiza',
    /lo escribi[óo] quien analiza|los nombres los escribi[óo] quien analiza/.test(cajaEsc),
    (cajaEsc.match(/.{0,40}escribi[óo] quien analiza.{0,50}/) || ['no lo declara'])[0]);


  /* ── §4 (v911) · EL PELDAÑO SE DECLARA, Y LA BANDA DICE LO QUE PERDIÓ ──
     La v901 escribió el orden de cesión como regla estructural y la propia
     v901 midió que no separaba nada: «paneles de texto» no existe en este
     pliego, así que el peldaño 1 quedó siendo «todo lo que se arma con
     caja()». Medido en el pliego real, eso cedía la carta solar y cinco
     estampas de satélite antes que un anillo de distancia.

     Estas comprobaciones viven acá y NO en la corrida normal del sector:
     a 1,77 km² la hoja compone las dos láminas sin ceder un solo panel, así
     que pasarían por no tener nada que rechazar — es la medición que la
     v910 hizo y por la que no tocó el orden. La corrida de 19,6 km² con la
     letra de colgar es el único material de la batería que cede de verdad. */
  console.log('\n  -- §4 · el orden de cesión, por peldaño declarado (v911) --');
  {
    /* Se mide sobre el PAPEL y no sobre `pliegoFuera`. Son dos cosas
       distintas: esa lista es lo que el programa DICE que cedió, y lo que
       hay que comprobar es lo que el lector no encuentra en la hoja. Es la
       regla de la v879 aplicada al orden de cesión, y cierra el agujero de
       una comprobación que se cree a sí misma.

       Y el peldaño 0 se reescribe acá, no se importa de `PELDANO_PLIEGO`:
       una comprobación que lee la misma tabla que el código solo prueba que
       la tabla es igual a sí misma. */
    const hojas = String(r.granPie || '').split('<div class="hoja').slice(1);
    const titulosDe = h => (String(h).match(/<h2>([^<]+)<\/h2>/g) || [])
      .map(x => x.replace(/<\/?h2>/g, '').trim());
    const mapasDe = h => (String(h).match(/data-m="([^"]+)"/g) || [])
      .map(x => x.replace(/data-m="|"/g, ''));
    T('la composición de letra grande sí cede: hay material que juzgar',
      hojas.length === 2 && titulosDe(r.granPie).length < titulosDe(r.doc).length,
      hojas.length + ' hojas · ' + titulosDe(r.granPie).length + ' cajas contra ' +
        titulosDe(r.doc).length + ' de la hoja sin apretar');
    /* Peldaño 0 · tiene que ESTAR en el papel, por apretada que quede. */
    /* La base es la MISMA corrida sin apretar, no una lista de lo que
       debería existir. Leyendo solo la hoja apretada, un panel ausente puede
       serlo por dos razones —cedió, o nunca tuvo dato— y el papel no las
       distingue: la foto satelital no está en esta corrida porque no se midió
       la cobertura, y la primera versión de esta aserción la denunció como
       cedida. Es la distinción de la v899 —«sin dato» y «panel fuera»— dicha
       en la suite. */
    const PAPEL_SIEMPRE = ['Síntesis del sector', 'Coherencia de las cifras', 'Plano del sector'];
    const baseT = titulosDe(r.docGran), baseM = mapasDe(r.docGran);
    const hayT = titulosDe(r.granPie), hayM = mapasDe(r.granPie);
    const faltan0 = PAPEL_SIEMPRE.filter(t => baseT.indexOf(t) >= 0 && hayT.indexOf(t) === -1);
    T('los paneles del peldaño 0 que la corrida trae siguen impresos al apretar',
      faltan0.length === 0 && PAPEL_SIEMPRE.filter(t => baseT.indexOf(t) >= 0).length >= 2,
      faltan0.length ? ('cedieron: ' + faltan0.join(' · '))
                     : (PAPEL_SIEMPRE.filter(t => baseT.indexOf(t) >= 0).length + ' de 3 en la corrida, y siguen'));
    const mapas0 = ['foto', 'calor:todos'].filter(m => baseM.indexOf(m) >= 0 && hayM.indexOf(m) === -1);
    const catBase = baseM.filter(m => /^calor:(?!todos)/.test(m));
    const catFuera = catBase.filter(m => hayM.indexOf(m) === -1);
    T('y los mapas que no ceden nunca: la foto, el de todos los usos y los de categoría',
      mapas0.length === 0 && catBase.length > 0 && catFuera.length === 0,
      (mapas0.length ? 'cedieron ' + mapas0.join(' · ') : 'ninguno de los dos cedió') +
        ' · categoría: ' + catBase.length + ' en la corrida, ' + catFuera.length + ' cedidos');
    /* El ORDEN, leído del papel: dentro de UNA hoja, si falta un panel de
       peldaño 3 tienen que faltar también los de peldaño 1. El par va de la
       misma hoja —`Asoleamiento` y `El grano` son las dos de la lámina A—
       porque entre hojas la comparación no mide un orden: mide en qué hoja
       está cada uno, que es lo que hizo roja la primera versión de esto. */
    const hojaA = hojas.filter(h => /L[ÁA]MINA A/i.test(h))[0] || hojas[0] || '';
    const tA = titulosDe(hojaA);
    const estaAso = tA.indexOf('Asoleamiento') >= 0, estaGrano = tA.indexOf('El grano: manzana y predio') >= 0;
    /* Y con su guarda de material: si la corrida no trae las dos cajas, esto
       no está comparando un orden — está comparando dos ausencias. */
    T('el par del orden existe en la corrida: hay con qué comparar',
      baseT.indexOf('Asoleamiento') >= 0 && baseT.indexOf('El grano: manzana y predio') >= 0,
      'Asoleamiento ' + (baseT.indexOf('Asoleamiento') >= 0 ? 'sí' : 'no') +
        ' · El grano ' + (baseT.indexOf('El grano: manzana y predio') >= 0 ? 'sí' : 'no'));
    T('en la lámina A, la carta solar no falta mientras un panel de peldaño menor sigue puesto',
      estaAso || !estaGrano,
      'Asoleamiento ' + (estaAso ? 'puesto' : 'FUERA') + ' · El grano ' + (estaGrano ? 'puesto' : 'fuera'));
    /* La serie temporal, cuando está compuesta. En esta corrida no se le
       inyecta la serie de fotos, así que la caja no existe y la aserción
       pasa por eso — y se dice, en vez de disfrazarlo de orden comprobado. */
    const hayCajaSerie = titulosDe(r.doc).indexOf('Cómo cambió el sitio') >= 0;
    T('la serie temporal tampoco, cuando está en la hoja',
      !hayCajaSerie || tA.indexOf('Cómo cambió el sitio') >= 0 || !estaGrano,
      hayCajaSerie ? 'compuesta' : 'no se compone en esta corrida: nada que ordenar');
  }

  /* La serie de fotos se lee en UN solo sitio (v911). El inventario decidía
     `listo` mirando `S.evo` y el cuerpo de la caja miraba `o.evo`: con la
     serie puesta por opciones la caja NO se componía y la casilla de la otra
     lámina sí afirmaba sobre ella — el §1 de la v910 esperando su tanda. */
  T('con la serie por opciones, la caja entra en el orden de cesión',
    r.serieCandidata === true,
    r.serieCandidata ? 'cede cuando la hoja aprieta'
                     : 'inmune por accidente: el inventario la da por no lista');
  /* Guarda, no afirmación nueva: la caja se componía en las dos versiones
     —el cuerpo siempre leyó `o.evo`—, así que esto no distingue una de otra.
     Está para que la unificación no se pase de rosca y la apague. */
  T('y sigue componiéndose, que es lo que no podía romperse',
    /<h2>Cómo cambió el sitio<\/h2>/.test(r.serieEnA || ''),
    /<h2>Cómo cambió el sitio<\/h2>/.test(r.serieEnA || '')
      ? 'compuesta' : 'el inventario la da por no lista con la serie en las opciones');

  console.log('\n  -- una banda sin su caja principal lo dice EN la banda (v911) --');
  {
    const filasFalta = (htm) => {
      const out = [];
      String(htm || '').replace(/<p class="b-falta">([\s\S]*?)<\/p>/g,
        (t, c) => { out.push(c.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()); return ''; });
      return out;
    };
    const conCesion = filasFalta(r.granPie);
    const sinCesion = filasFalta(r.docGran);
    const aMano = filasFalta(r.apagadaAMano);
    T('la banda que perdió su caja principal lo imprime, con su nombre',
      conCesion.some(x => /Asoleamiento/.test(x)),
      conCesion.length ? conCesion.map(x => x.slice(0, 60)).join(' · ') : 'ningún renglón');
    const aso = conCesion.filter(x => /Asoleamiento/.test(x))[0] || '';
    T('y dice QUÉ lleva esa caja, que es lo que el lector no puede adivinar',
      /carta solar/.test(aso) && /orientaci[oó]n de fachadas/.test(aso), aso.slice(0, 120));
    T('y cómo recuperarla, en vez de dejarlo en la ausencia',
      /apague otro panel/i.test(aso) && /imprima esta hoja suelta/i.test(aso), aso.slice(-110));
    /* Las dos guardas contra pasarse de avisar, que son la otra mitad:
       una hoja que no cedió nada no puede decir que perdió algo, y una caja
       que apagó una persona no «cedió el sitio». */
    T('una hoja que no cedió su principal no imprime ningún renglón',
      sinCesion.length === 0,
      sinCesion.length ? sinCesion.join(' · ') : 'ninguno, que es lo correcto');
    T('y una caja apagada A MANO no se declara como cedida',
      aMano.length === 0,
      aMano.length ? aMano.map(x => x.slice(0, 80)).join(' · ') : 'ninguno');
  }

  console.log('\n  -- la franja de export de prueba (v914) --');
  /* Los dos PDF de muestra publicados en `assets/pliegos/` llevan un LEEME al
     lado que dice que son datos de fixture. Un PDF viaja SOLO: reenviado por
     correo o por WhatsApp, el archivo de al lado no lo sigue, así que lo que
     el pliego no diga de s\u00ed mismo no est\u00e1 dicho — que es la regla de toda
     esta hoja aplicada al archivo en vez de a una cifra.

     Las dos ramas, y la guarda importa m\u00e1s que la afirmaci\u00f3n: una franja que
     saliera siempre marcar\u00eda como prueba el an\u00e1lisis de un predio de verdad. */
  {
    const franjas = (htm) => (String(htm || '').match(/class="hoja-prueba"/g) || []).length;
    T('el pliego normal no lleva ninguna franja de prueba',
      franjas(r.doc) === 0, franjas(r.doc) + ' franjas');
    T('y el export de prueba la lleva en LAS DOS hojas',
      franjas(r.conFranja) === 2, franjas(r.conFranja) + ' franjas de 2 hojas');
    const txt = (String(r.conFranja || '')
      .match(/<p class="hoja-prueba">([\s\S]*?)<\/p>/) || ['', ''])[1]
      .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    T('y dice que no es el an\u00e1lisis de ning\u00fan predio real',
      /fixture/i.test(txt) && /no es el an[a\u00e1]lisis/i.test(txt), txt || 'sin texto');
  }

  console.log('\n  -- un chequeo no PASA contra SIN MEDIR (v910) --');
  /* §2 del pliego v2. Desde la v899 una casilla que no se pudo medir imprime
     la palabra «SIN MEDIR» donde iba la cifra. Los doce chequeos cruzados
     solo miraban `null`, y una cadena es verdadera: salía impreso
     «PASA · 103 cruces por km² (lámina A) · SIN MEDIR (lámina B)» — que es
     el error típico que el propio panel nombra dos renglones más abajo.

     Se persigue la CLASE y no ese chequeo: en las dos hojas compuestas,
     ningún chequeo marcado «pasa» puede llevar «SIN MEDIR» en ninguno de
     sus dos lados. Así un chequeo nuevo hereda la guarda. */
  const filasCoh = (htm) => {
    const out = [];
    String(htm || '').replace(/<li class="coh-([a-z-]+)[^"]*">([\s\S]*?)<\/li>/g,
      (todo, est, cuerpo) => { out.push({ est: est, txt: cuerpo.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }); return ''; });
    return out;
  };
  /* Sobre el DOCUMENTO compuesto —que es lo que se imprime— y sobre la
     composición en la que dos paneles ceden, que es donde la v899 metió el
     estado «panel fuera» y donde más fácil se cuela un lado vacío. */
  const cohA = filasCoh(r.doc), cohB = filasCoh(r.docCede);
  /* Guarda de MATERIAL: sin filas leídas esta comprobación no mide nada, y
     es justo el aspecto que tendría si el `<li>` cambiara de clase. */
  T('los chequeos de coherencia se leen del papel',
    cohA.concat(cohB).length >= 10,
    cohA.length + ' en A · ' + cohB.length + ' en B');
  const chequeosSM = cohA.concat(cohB)
    .filter(x => x.est === 'pasa' && /SIN MEDIR/i.test(x.txt))
    .map(x => x.txt.slice(0, 110));
  T('ningún chequeo marcado «pasa» tiene un lado en SIN MEDIR',
    chequeosSM.length === 0,
    chequeosSM.length ? chequeosSM.join(' · ') : 'ninguno de los doce pasa contra un lado vacío');

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

  /* 0 · §3 (v898) · CADA GLIFO SE DIBUJA UNA SOLA VEZ.
     ──────────────────────────────────────────────────────────────────────
     Llegó del pliego v2 con el síntoma escrito: «VVeerrddee nnaattuurraall»,
     «CCuueerrppoo ddee aagguuaa», «7744,,44 ddBB((AA))», y «sobre todo El
     lote a intervenir, donde las cotas de los 52 lados quedan completamente
     ilegibles».

     La causa se midió sobre el PDF y no leyendo: un `<text>` con
     `stroke` + `paint-order` sale del motor de impresión como DOS bloques
     de texto en la MISMA matriz —uno blanco, glifo a glifo, y encima el de
     tinta—. Catorce rótulos así en una sola corrida de estas dos hojas.

     Se persigue la CLASE: ningún nodo de texto de la hoja lleva un trazo
     que pinte. Un renglón que diga «y sin `paint-order`» no serviría: el
     `paint-order` no crea la segunda pasada, la ordena, y era justamente lo
     que había. */
  {
    const conTrazo = [].concat(A.textoConTrazo || [], B.textoConTrazo || []);
    T('ningún rótulo se pinta dos veces: nada de trazo sobre el texto',
      conTrazo.length === 0, conTrazo.length + (conTrazo.length ? ' · ' + conTrazo.slice(0, 4).join(' · ') : ''));
  }

  /* 0b · Las cotas del plano del lote. El lote de esta suite es un predio de
     ocho lados (v890), así que acá TODAS caben: lo que se mide es que no se
     haya perdido ninguna por el arreglo, y que no aparezca ni un número ni
     el cuadro donde no hacen falta. La otra rama —la del lote al que no le
     cabe— la mide `tpliegogrande`, cuyo lote tiene veintidós lados y la
     produce de verdad; es la lección de la v874 y esta vez no hizo falta
     empobrecer ningún material: ya había uno que la destapa. */
  {
    const lo = A.lote || B.lote;
    T('el plano del lote imprime sus cotas', !!lo && lo.cotas >= 8,
      lo ? lo.cotas + ' cotas' : 'no hay plano del lote');
    T('y ninguna se pisa con otra', !!lo && lo.solapes === 0,
      lo ? lo.solapes + ' solapes' : '—');
    T('con ocho lados caben todas: ni un número ni cuadro al pie',
      !!lo && lo.numerados === 0 && lo.cuadro === false,
      lo ? lo.numerados + ' numerados · cuadro ' + lo.cuadro : '—');
  }

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

  /* ── §4 · La banda de forma (v877) ───────────────────────────────────
     «El degradado no se puede calcar; la línea sí. Con la línea, todos los
     estudiantes trazan la misma geometría medida.» Eso convierte la banda de
     usos —un inventario— en insumo de forma, que es lo que el pliego pide. */
  console.log('\n  -- §4 · la mancha se puede calcar --');
  {
    const doc = String(r.doc || '');
    const txtD = doc.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');
    /* Dos contornos por categoría, con grosor distinto: el delgado es el
       borde y el grueso el núcleo duro. Se buscan por el grosor, que es lo
       que los distingue en el papel. */
    const borde = (doc.match(/stroke-linejoin="round" stroke-width="0\.7"/g) || []).length;
    const nucleo = (doc.match(/stroke-linejoin="round" stroke-width="1\.5"/g) || []).length;
    T('cada mancha lleva su contorno de borde, trazado donde el calor cruza el umbral',
      borde >= 3, borde + ' contornos de borde');
    T('y donde hay núcleo duro, su segunda línea más gruesa',
      nucleo >= 1, nucleo + ' contornos de núcleo');
    /* Los umbrales van IMPRESOS: moviendo el umbral cambia la forma, así que
       el umbral es parte del dato y no una decisión de dibujo. */
    T('los dos umbrales van escritos, con su valor',
      /2 usos o más \(borde\)/.test(txtD) && /4 o más \(núcleo duro\)/.test(txtD),
      (txtD.match(/la delgada en[^.]{0,70}/) || ['no los escribe'])[0]);
    T('y la hoja explica por qué la línea y no solo el degradado',
      /degradado no se puede calcar/.test(txtD),
      (txtD.match(/degradado no se puede calcar[^.]{0,60}/) || ['no lo explica'])[0]);
    /* Al pie de cada mapa: área de la mancha y rumbo del eje mayor. Un uso en
       corredor y uno repartido parejo no se leen igual, y sin el rumbo esa
       diferencia se queda en la impresión de quien mira. */
    const pies = (txtD.match(/\d+ usos · mancha [\d.,]+ ha[^A-ZÁÉÍÓÚ]{0,90}/g) || []);
    T('cada mapa dice el área de su mancha en hectáreas',
      pies.length >= 3, pies.slice(0, 2).join(' | ').slice(0, 140));
    T('y el rumbo de su eje mayor, o que no tiene eje dominante',
      pies.length > 0 && pies.every(x => /eje a \d+°|sin eje dominante/.test(x)),
      pies.slice(0, 2).join(' | ').slice(0, 150));
    /* Y las DOS ramas se ejercitan: las farmacias del sector van sobre un
       corredor, así que su mancha tiene rumbo; las demás están repartidas y
       no. Sin una categoría alineada, «dice el rumbo o dice que no hay»
       pasaría siempre por la segunda mitad y el cálculo del eje podría estar
       roto sin que nada lo viera — la lección de la v874. */
    T('una categoría en corredor da su rumbo en grados',
      pies.some(x => /eje a \d+°/.test(x)),
      (pies.filter(x => /eje a/.test(x))[0] || 'ninguna con eje').slice(0, 120));
    T('y otra repartida pareja dice que no tiene eje, en vez de inventarle uno',
      pies.some(x => /sin eje dominante/.test(x)),
      (pies.filter(x => /sin eje/.test(x))[0] || 'ninguna sin eje').slice(0, 120));
    /* Y el método, UNA vez para la fila: era idéntico bajo los ocho mapas,
       palabra por palabra, en la banda más grande de la hoja. */
    const veces = (txtD.match(/isolíneas de ese conteo/g) || []).length;
    T('el método de la fila se imprime una sola vez, no bajo cada mapa',
      veces === 1, veces + ' veces');
  }

  /* ══ §20 · cada propuesta cita SU dato, y la factibilidad separa o no se
        imprime (v889) ═══════════════════════════════════════════════════
     El pliego de ajustes, con la hoja impresa delante: «ese mismo texto
     aparece idéntico en las cinco propuestas: cada propuesta tiene que citar
     su propio dato» y «las cinco salieron con factibilidad Media y redacción
     casi idéntica. Si el método no discrimina factibilidad, no imprimir la
     etiqueta».

     Las dos mitades se miden sobre el PAPEL —los cinco renglones compuestos,
     comparados entre sí—, que es donde el defecto existe: en las variables
     cada propuesta tiene su objeto y parece distinta. */
  console.log('\n  -- §20 · cada propuesta con su dato --');
  {
    const P = B.props || [];
    T('el cierre imprime cinco propuestas', P.length === 5, P.length + '');
    const distintos = a => new Set(a.filter(Boolean)).size;
    /* La comprobación central, y persigue la CLASE: no busca la frase vieja
       —«lo medido no muestra déficit», que entraba idéntica en cuatro de las
       cinco— sino que dos propuestas cualesquiera digan lo mismo. Una tanda
       futura que invente otro relleno repetido vuelve a ponerla en rojo. */
    T('las cinco citan cifras distintas: ninguna repite el texto de otra',
      P.length === 5 && distintos(P.map(x => x.necTexto)) === 5,
      distintos(P.map(x => x.necTexto)) + ' textos distintos de ' + P.length);
    T('y ninguna repite la razón de otra',
      P.length === 5 && distintos(P.map(x => x.razon)) === 5,
      distintos(P.map(x => x.razon)) + ' razones distintas de ' + P.length);
    T('cada una contrasta el lote contra el área típica de SU uso',
      P.length === 5 && distintos(P.map(x => x.facTexto)) === 5,
      (P[0] || {}).facTexto + ' | ' + (P[2] || {}).facTexto);
    /* Lo que da el SITIO vale igual para las cinco, así que va una vez
       arriba. Repetido en cada renglón se disfrazaba de hallazgo de esa
       propuesta y enterraba lo único que sí cambiaba. */
    T('las condiciones del sitio se dicen una sola vez, fuera de las cinco',
      (B.sitio || []).length >= 1 && /Lo que da el sitio, igual para las cinco/.test((B.sitio || [])[0] || ''),
      ((B.sitio || [])[0] || 'no las dice').slice(0, 90));
    T('y no se repiten dentro de ninguna propuesta',
      P.length > 0 && !P.some(x => /esquinero|pieza[s]? de servicios|vía principal a/.test(x.facTexto)),
      (P.filter(x => /esquinero|servicios/.test(x.facTexto))[0] || { facTexto: 'ninguna las repite' }).facTexto.slice(0, 90));
    /* El relleno entraba con necesidad 8 —un número inventado— y con él
       ADELANTABA a los usos que sí tenían cobertura medida. Que el colegio y
       la salud estén en las cinco es la prueba de que ya no. */
    T('los usos con cobertura medida entran a las cinco, no los desplaza un relleno',
      P.some(x => /colegio o jardín/.test(x.necTexto)) && P.some(x => /servicio de salud/.test(x.necTexto)),
      P.map(x => x.necTexto.slice(0, 26)).join(' | ').slice(0, 150));
    /* Un uso cuya capa está vacía no puede salir con «necesidad baja»: sería
       afirmar sobre lo que la misma caja manda a comprobar dos centímetros
       más abajo. Guarda de clase; el material que la ejercita está en
       `tsinmapear`, cuyo sector no tiene ni parques ni paradas. */
    T('lo que no se pudo medir no sale como necesidad baja',
      !P.some(x => /^sin medir/.test(x.necTexto) && x.nec !== 'sin medir'),
      (P.filter(x => /^sin medir/.test(x.necTexto))[0] || { nec: 'ninguna sin medir en este sector' }).nec);

    /* ── La factibilidad: separa, o no se imprime ──────────────────────── */
    const etiquetas = P.map(x => x.fac);
    const rotulos = P.map(x => x.facRotulo);
    T('con un lote de 18 ha la etiqueta no separa nada y no se imprime cinco veces',
      rotulos.length === 5 && rotulos.every(x => /El lote para este uso/.test(x)),
      rotulos.join(' | ').slice(0, 110));
    T('y se dice UNA vez, con el criterio escrito',
      (B.sitio || []).some(x => /Factibilidad · \w+ para las cinco/.test(x) &&
        /sobra, cabe, justo, corto/.test(x) && /POT/.test(x)),
      ((B.sitio || [])[1] || 'no lo dice').slice(0, 120));
    /* Y la otra rama, que es la que impide que esto sea un verde: con un
       lote de barrio de 601 m² el criterio SÍ produce valores distintos, y
       entonces la etiqueta se imprime propuesta por propuesta. */
    const ch = r.loteChico || '';
    const facCh = (ch.match(/<i>Factibilidad<\/i><b>([^<]*)<\/b>/g) || [])
      .map(x => (x.match(/<b>([^<]*)<\/b>/) || [0, ''])[1]);
    T('con un lote de barrio la etiqueta sí se imprime, propuesta por propuesta',
      facCh.length === 5, facCh.length + ' etiquetas');
    T('y produce valores distintos, que es lo que §20 exige para imprimirla',
      new Set(facCh).size >= 2, facCh.join(' · ') || 'ninguna');
    T('el lote chico separa el uso que cabe del que queda corto',
      /corto: el lote es el \d+ % de los/.test(ch) && /justo: el lote es el \d+ % de los/.test(ch),
      (ch.match(/corto: el lote es el \d+ % de los [\d.]+ m²/) || ['no lo separa'])[0]);
  }
  /* §20 · «revisar que no quede ningún marcador de plantilla sin
     reemplazar». Persigue la clase sobre los NODOS de texto de las dos
     hojas: un marcador sin sustituir, un `undefined` de una propiedad que
     cambió de nombre o un `[object Object]` son todos el mismo defecto —algo
     que el programa iba a reemplazar y no reemplazó— y el lector los ve
     igual. Se mira por nodo y no sobre la tira, que es la lección de la
     v885: `textContent` pega lo de dos elementos vecinos. */
  {
    const MARCA = /@@[A-Z_]+@@|\{\{[^}]*\}\}|\bundefined\b|\bNaN\b|\[object Object\]|<%[^%]*%>/;
    const sucios = M.reduce((a, h) => a.concat((h.trozos || []).filter(t => MARCA.test(t))
      .map(t => h.id + ': ' + t.slice(0, 70))), []);
    T('ninguna hoja imprime un marcador de plantilla sin reemplazar',
      sucios.length === 0, sucios.slice(0, 3).join(' · ') || 'ninguno');
  }

  /* ══ §8 · la hoja dice a qué escala se analizó ═════════════════════════
     El pliego, sobre la corrida real: «radio de 2.500 m: 19,63 km², 77.145
     habitantes. Eso no es un sector, es un tercio de Cúcuta». La hoja
     imprimía el radio y nada sobre lo que ese radio le hace a toda cifra por
     habitante y por hectárea de la lámina.

     Se miden LAS DOS ramas en la misma corrida, que es lo que una sola no
     puede enseñar: este sector, que sí es de escala de sector, y una segunda
     corrida de 19,6 km² que no lo es. */
  console.log('\n  -- §8 · a qué escala se analizó --');
  {
    const linea = (h) => {
      const m = String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
        .match(/(Esto no es un sector\.?\s*)?Escala del análisis:[^]{0,900}/);
      return m ? m[0] : '';
    };
    const lA = linea(r.soloA) || linea(r.doc);
    T('la lámina declara la escala del área analizada',
      /Escala del análisis:/.test(lA), lA.slice(0, 70) || 'no la declara');
    /* La referencia no es un umbral inventado: es el área censada del
       municipio —la misma de la comparación de la v876— y los tres radios
       que la propia hoja compara. Un corte puesto a ojo sería el error del
       techo de Overpass de la v869. */
    T('y la dice con una referencia medida, no con un umbral a ojo',
      /km²/.test(lA) && /radio equivalente de [\d.]+ m/.test(lA) &&
      /% del área censada de/.test(lA),
      lA.slice(0, 150));
    T('este sector cae en el rango que la hoja compara, y lo dice',
      /dentro del rango de sector/.test(lA) && !/Esto no es un sector/.test(lA),
      (lA.match(/(dentro del rango de sector|Esto no es un sector)/) || ['no lo dice'])[0]);
    // Y la rama que el pliego reportó: 19,6 km², que no es un sector.
    const lG = linea(r.granEscala);
    T('una corrida de 19,6 km² sí se analiza, no se rechaza',
      (r.granEscala || '').length > 20000, ((r.granEscala || '').length) + ' caracteres de hoja');
    T('y la hoja lo dice con esas palabras: esto no es un sector',
      /Esto no es un sector/.test(lG), lG.slice(0, 90) || 'no lo dice');
    T('nombra la superficie y qué parte del municipio es',
      /1[89],\d+ km²|19 km²|2[01],\d+ km²/.test(lG) && /% del área censada de/.test(lG),
      (lG.match(/[\d,.]+ km²[^.]{0,70}/) || ['no lo nombra'])[0]);
    /* Lo que de verdad hay que decirle a quien lee: qué le hace esa escala a
       las cifras. Sin esta frase el aviso sería un rótulo. */
    T('y explica que las cifras por habitante son promedios del conjunto',
      /por habitante o por hectárea/.test(lG) && /no ninguno de los barrios/.test(lG),
      (lG.match(/promedio sobre[^.]{0,90}/) || ['no lo explica'])[0]);
    T('con el remedio al lado: volver a analizar a unos 800 m',
      /volver a\s+analizar con un radio de unos 800 m/.test(lG.replace(/\s+/g, ' ')),
      (lG.match(/Para leer un barrio[^.]{0,80}/) || ['sin remedio'])[0]);
    /* Y no se topa ni se rechaza: la hoja sale entera, con su aviso. Es la
       decisión de la v875 con la necesidad y la de la v886 con los mapas. */
    /* El aviso no TAPA nada: se suma al panel del radio, que es donde vive
       el tema, en vez de reemplazar la hoja o quitarle cajas. Es la decisión
       de la v875 con la necesidad topada y la de la v886 con los mapas
       chicos: se declara, no se recorta.

       Se mide por el SITIO donde cae —dentro del bloque `.radios`, al lado
       de la tabla de los tres radios— y porque la hoja grande sigue trayendo
       sus cajas de siempre. Contar cajas contra la hoja del sector chico
       mediría otra cosa: esa corrida trae además el trazado, la cobertura y
       el terreno, que esta segunda no volvió a medir. */
    const bloqueRadios = (String(r.granEscala || '').split('<div class="radios">')[1] || '')
      .split('</div>')[0];
    T('el aviso va dentro del panel del radio, no como caja aparte',
      /esc-an/.test(bloqueRadios),
      !bloqueRadios ? 'no hay panel de radio' : /esc-an/.test(bloqueRadios) ? 'en el panel del radio' : 'el panel del radio no lo trae');
    T('y la hoja grande sale entera: el aviso se suma, no recorta',
      /<h2>El sitio<\/h2>/.test(r.granEscala || '') &&
      /<h2>Dónde queda, escala por escala<\/h2>/.test(r.granEscala || ''),
      ((r.granEscala || '').match(/<h2>[^<]+<\/h2>/g) || []).length + ' cajas');
  }

  T('y la página no soltó errores', err.length === 0, err.slice(0, 2).join(' · ') || 'ninguno');

  console.log('\n  ' + (mal ? mal + ' comprobaciones fallaron' : 'todo en verde'));
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
