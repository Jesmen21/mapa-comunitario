const E = require('../entorno.js');
/* LA LÁMINA EDUCATIVA · tanda 1: diagramación, cierre y pregunta por banda

   Llegó como un pliego de instrucciones para el módulo educativo —la lámina
   de 60 × 90 que un estudiante entrega a un jurado— y esta suite mide la
   primera tanda, con estas reglas escritas:

     · «Un mapa: lo más grande que dé el papel, y ESTÁN TODOS.» Lo pidió
        dos veces: «no me dejes mapas a un lado» y, con el pliego impreso
        de la v849 en la mano, «me quitó todos los mapas que tanto me
        gustaban, las de alturas; que se muestren todos los mapas que antes
        salían». Entre v847 y v849 un piso de 120 mm por mapa apagaba
        paneles hasta dejar cinco de quince; desde v850 los mapas se
        encogen con la hoja y ninguno se cae.
     · «Los dos principales, del mismo tamaño»: la foto satelital y el
        plano del sector, mismas columnas y mismo alto en el papel.
     · «Los mapas de calor por categoría, todos»: uno por cada uso con
        peso —comercio, institucional, salud, cultura—, no dos de muestra.
     · «Una cifra suelta es una baldosa chica: cuatro caben en el ancho de
        un mapa.»
     · «Antes de cada banda, una línea con la pregunta que responde; al
        final, una conclusión de una o dos líneas.»
     · «Reemplazar la DOFA genérica por una RECOMENDACIÓN DE USO: cinco
        propuestas ordenadas, cada una con necesidad y factibilidad, la razón
        explícita y el lote concreto.»
     · «La síntesis se reduce al alto de su contenido.»

   Se monta el mismo sector de `tpliegogrande` —el de veintidós lados, con
   trazado y foto leída, que es el que revienta la hoja— y se miden las dos
   láminas a tamaño real: milímetros de papel, con la reducción ya aplicada,
   que es lo que sale de la impresora. Nada de esto se comprueba en el HTML
   sin montar: un mapa de 120 mm en la hoja de estilo y de 80 en el papel es
   justamente el fallo que se busca.                                          */
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
    o.lados = (R.loteDePrueba() || []).length;
    const bc = document.querySelector('#pcr-lote-barra [data-lote="cerrar"]');
    if (bc) { bc.click(); await esperar(900); }
    R.abrir(); await esperar(500);
    const asa = H().querySelector('[data-pcr="agrandar"]'); if (asa) { asa.click(); await esperar(400); }
    const medir = async (acc, sel) => {
      const x = H().querySelector('[data-pcr="' + acc + '"]');
      if (!x) return false;
      x.click();
      for (let i = 0; i < 70 && !document.querySelector(sel); i++) await esperar(400);
      await esperar(250); return !!document.querySelector(sel);
    };
    await esperar(5200);   // el limitador de Overpass
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
    o.cobertura = !!R.cobertura();

    const cn = document.getElementById('pcr-nombre');
    if (cn) { cn.value = 'La Playa'; cn.dispatchEvent(new Event('input', { bubbles: true })); }
    const bv = H().querySelector('[data-pcr="lamina-ver"]');
    if (bv) { bv.click(); await esperar(500); }
    o.v = capturado; capturado = '';
    o.fueraV = ((R.estado() || {}).pliegoFuera || []).slice();
    o.completa = R.laminaA({});
    const bh = H().querySelector('[data-pcr="lamina-ver-h"]');
    if (bh) { bh.click(); await esperar(500); }
    o.h = capturado; capturado = '';
    o.fuera = ((R.estado() || {}).pliegoFuera || []).slice();
    /* Las propuestas, tal como las calcula el módulo, para cotejar el orden
       impreso contra el calculado. */
    try { o.propuestas = R.propuestasDeUso(); } catch (e) { o.propuestas = null; }
    try { o.categorias = R.categoriasQueCambian(2); } catch (e) { o.categorias = null; }
    return o;
  }, { C, POL, LOTE });

  /* Cada lámina montada a tamaño real. Todo en MILÍMETROS DE PAPEL con la
     reducción aplicada: `getBoundingClientRect` la cuenta; `offsetWidth` no. */
  const medir = async (html, w, h) => {
    const m = await ctx.newPage();
    await m.setViewportSize({ width: w, height: h });
    await m.setContent(html || '<i></i>', { waitUntil: 'load' });
    await m.waitForTimeout(600);
    const out = await m.evaluate(() => {
      const PX = 3.7795275;
      const hoja = document.querySelector('.hoja');
      const rej = document.querySelector('.rej'), marco = document.querySelector('.rejilla');
      if (!hoja || !rej || !marco) return null;
      const mm = px => Math.round(px / PX * 10) / 10;
      const esc = (function () {
        const t = getComputedStyle(rej).transform;
        const mmx = t && t !== 'none' ? t.match(/matrix\(([\d.]+)/) : null;
        return mmx ? Number(mmx[1]) : 1;
      })();
      const rect = el => el.getBoundingClientRect();
      const svgDe = c => c.querySelector('.mp-dib svg, .plano-cuerpo svg');
      return {
        escala: esc,
        pide: mm(rect(rej).height), papel: mm(rect(marco).height),
        mapas: [...document.querySelectorAll('.mapa-caja, .plano-hero')].map(c => {
          const s = svgDe(c), rb = s ? rect(s) : { width: 0, height: 0 };
          return { id: c.getAttribute('data-m') || 'plano', t: (c.querySelector('h2') || {}).textContent || '?',
            w: mm(rb.width), h: mm(rb.height),
            cajaW: c.offsetWidth };
        }),
        /* La capa de método de cada caja y de cada mapa: las cinco etiquetas. */
        metodos: [...document.querySelectorAll('.caja:not(.caja-campo):not(.caja-vacio)')].map(c => ({
          t: (c.querySelector('h2') || {}).textContent || '?',
          etiquetas: [...c.querySelectorAll(':scope > .metodo i')].map(i => i.textContent),
          texto: ((c.querySelector(':scope > .metodo') || {}).textContent || '') })),
        radios: (function () {
          const r = document.querySelector('.radios'); if (!r) return null;
          return { texto: r.textContent.replace(/\s+/g, ' '), filas: r.querySelectorAll('.rad tr').length - 1,
                   elegido: !!r.querySelector('.rad tr.el') };
        })(),
        caminar: (function () {
          const c = document.querySelector('.mapa-caja[data-m="caminar"]'); if (!c) return null;
          return { conv: ((c.querySelector('.conv-mp') || {}).textContent || '').replace(/\s+/g, ' '),
                   pie: (c.querySelector('.mp-pie') || {}).textContent || '',
                   poligonos: c.querySelectorAll('.mp-dib svg polygon, .mp-dib svg path[fill-opacity]').length };
        })(),
        biblio: { n: document.querySelectorAll('.pie .biblio li').length,
                  texto: ((document.querySelector('.pie .biblio') || {}).textContent || '').replace(/\s+/g, ' ') },
        propia: (function () {
          const p = document.querySelector('.sintesis-pie .propia'); if (!p) return null;
          const r = p.querySelector('.renglones');
          return { alto: r ? mm(rect(r).height) : 0, texto: p.textContent.replace(/\s+/g, ' ') };
        })(),
        vacios: [...document.querySelectorAll('.caja-vacio')].map(c => ({
          t: (c.querySelector('h2') || {}).textContent || '?', alto: mm(rect(c).height), w: c.offsetWidth,
          tag: (c.querySelector('.vacio-tag') || {}).textContent || '',
          falta: (c.querySelector('.vacio-falta') || {}).textContent || '',
          hay: (c.querySelector('.vacio-hay') || {}).textContent || '',
          renglon: !!c.querySelector('.renglones'), texto: c.textContent })),
        cruces: [...document.querySelectorAll('.sintesis-pie .cruce')].map(c => ({
          k: (c.querySelector('.cv-k') || {}).textContent || '', v: (c.querySelector('.cv-v') || {}).textContent || '',
          l: (c.querySelector('.cv-l') || {}).textContent || '' })),
        decisiones: [...document.querySelectorAll('.banda-ambiental .caja .decide')].map(d => ({
          t: (d.closest('.caja').querySelector('h2') || {}).textContent || '?', texto: d.textContent })),
        campo: [...document.querySelectorAll('.caja-campo')].map(c => ({
          t: (c.querySelector('h2') || {}).textContent || '?', alto: mm(rect(c).height),
          casillas: c.querySelectorAll('.cf').length, renglones: !!c.querySelector('.renglones'),
          instruccion: (c.querySelector('.lee') || {}).textContent || '' })),
        // La pista nominal: la rejilla en medias columnas (16 parada, 24 acostada).
        unidad: rej.offsetWidth / (document.querySelector('.hoja').offsetWidth > document.querySelector('.hoja').offsetHeight ? 24 : 16),
        cifras: [...document.querySelectorAll('.caja-cifra')].map(c => ({
          t: (c.querySelector('h2') || {}).textContent || '?', w: c.offsetWidth,
          // La caja entera vecina en la misma banda, si la hay: una baldosa vale la mitad.
          vecina: (function () { const v = [...c.parentElement.querySelectorAll(':scope > .caja:not(.caja-cifra):not(.mapa-caja):not(.plano-hero):not(.caja-doble):not(.caja-alta)')][0]; return v ? v.offsetWidth : 0; })(),
          // Un dibujo de verdad, no el icono de la esquina, que también es svg.
          svg: !!c.querySelector('.dib, .mp-dib, .plano, .perf, .camina, .b, .evo-tira'),
          recortada: c.scrollHeight > c.clientHeight + 2 })),
        cajas: [...document.querySelectorAll('.caja')].length,
        bandas: [...document.querySelectorAll('.banda')].map(b => ({
          t: (b.querySelector('h3') || {}).textContent || '?',
          pregunta: (b.querySelector('.b-pregunta') || {}).textContent || '',
          cierre: (b.querySelector('.b-cierre') || {}).textContent || '' })),
        leeAsi: (document.querySelector('.cab .lee-asi') || {}).textContent || '',
        cierre: (function () {
          const s = document.querySelector('.sintesis-pie');
          if (!s) return null;
          const cuerpo = s.closest('.bcuerpo');
          return {
            foda: !!s.querySelector('.foda'),
            filas: [...s.querySelectorAll('.pu')].map(p => ({
              uso: (p.querySelector('.pu-uso') || {}).textContent || '',
              nec: Number(p.getAttribute('data-nec')), fac: Number(p.getAttribute('data-fac')),
              necNivel: (p.querySelector('.pu-nec b') || {}).textContent || '',
              facNivel: (p.querySelector('.pu-fac b') || {}).textContent || '',
              facTexto: (p.querySelector('.pu-fac small') || {}).textContent || '',
              razon: (p.querySelector('.pu-razon') || {}).textContent || '' })),
            objeto: (s.querySelector('.lee b') || {}).textContent || '',
            nota: (s.querySelector('.props-nota') || {}).textContent || '',
            // El alto de la caja contra el de su rejilla: el papel muerto.
            sobra: mm(rect(cuerpo).height - rect(s).height),
            recortada: s.scrollHeight > s.clientHeight + 2
          };
        })()
      };
    });
    await m.close();
    return out;
  };
  const V = await medir(r.v, 2268, 3402);
  const HZ = await medir(r.h, 3402, 2268);
  // La hoja completa —la misma composición, sin el recorte del papel—: donde
  // se comprueba lo que es propiedad de la composición y no de lo que cupo.
  const VC = await medir(r.completa, 2268, 3402);
  await pg.close(); await b.close();
  fs.writeFileSync(S + 'lamina-edu-v.html', r.v || '', 'utf8');
  fs.writeFileSync(S + 'lamina-edu-h.html', r.h || '', 'utf8');

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

  console.log('\n  -- el sector: lote, trazado y foto --');
  T('el lote quedó de veintidós lados y el trazado medido', r.lados === 22 && r.trazado === true, r.lados + ' lados');
  T('salieron las dos láminas', (r.v || '').length > 20000 && (r.h || '').length > 20000);
  console.log('  · quedó fuera de la última: ' + ((r.fuera || []).join(', ') || 'nada'));

  [['parada 60 × 90', V], ['acostada 90 × 60', HZ]].forEach(([nom, o]) => {
    console.log('\n  -- ' + nom + ': están TODOS los mapas --');
    if (!o) { T('la lámina se pudo montar', false); return; }
    const analisis = o.mapas;
    const menor = m => Math.min(m.w, m.h);
    /* Los que el sector midió, por su identificador. En la v849 impresa
       salieron cinco: la foto, el plano, la cobertura, los llenos y todos
       los usos. Los otros diez —las alturas entre ellos— los apagaba el
       piso de 120 mm. */
    const DEBEN = ['foto', 'plano', 'cobertura', 'llenos', 'alturas', 'vias', 'hitos',
                   'caminar', 'llega', 'comercial', 'anillos', 'ruido', 'sombras',
                   'sombra-proyecto', 'calor:todos'];
    const hay = analisis.map(m => m.id);
    const faltan = DEBEN.filter(id => hay.indexOf(id) < 0);
    T('están los quince que este sector mide, ninguno a un lado', faltan.length === 0,
      hay.length + ' mapas · faltan: ' + (faltan.join(', ') || 'ninguno'));
    /* Y ninguno reducido a una estampilla: 45 mm de alto de papel es el
       piso histórico, el que separa un mapa de un icono. */
    const bajos = analisis.filter(m => m.h < 45);
    T('y ninguno queda de estampilla: 45 mm de alto como mínimo, con la hoja ya reducida',
      analisis.length >= 10 && bajos.length === 0,
      bajos.length ? bajos.map(m => m.t + ' ' + m.w + '×' + m.h).join(' · ')
                   : 'el más bajo ' + Math.min.apply(null, analisis.map(m => m.h)) + ' mm · compuesta al ' + Math.round(o.escala * 100) + '%');
    T('y la hoja cierra igual: no se desborda',
      o.pide <= o.papel + 2, o.pide + ' de ' + o.papel + ' mm');

    console.log('\n  -- ' + nom + ': los dos principales, del mismo tamaño --');
    const foto = o.mapas.filter(m => m.id === 'foto')[0];
    const plano = o.mapas.filter(m => m.id === 'plano')[0];
    T('la foto satelital y el plano del sector están los dos', !!foto && !!plano);
    T('y miden lo mismo: ni uno más grande que el otro',
      !!foto && !!plano && Math.abs(foto.w - plano.w) <= 3 && Math.abs(foto.h - plano.h) <= 3,
      foto && plano ? foto.w + '×' + foto.h + ' contra ' + plano.w + '×' + plano.h + ' mm' : 'falta uno');
    T('y son los más grandes de la hoja: nada de análisis les gana de alto',
      !!foto && analisis.every(m => m.h <= foto.h + 1),
      foto ? foto.h + ' mm contra ' + Math.max.apply(null, analisis.map(m => m.h)) + ' del mayor de los demás' : '-');

    console.log('\n  -- ' + nom + ': un mapa de calor por cada uso con peso --');
    const todos = o.mapas.filter(m => m.id === 'calor:todos')[0];
    const cat = o.mapas.filter(m => /^calor:/.test(m.id) && m.id !== 'calor:todos');
    T('el de todos los usos está', !!todos);
    /* Cuatro categorías tiene este sector con tres usos o más, y las cuatro
       llevan mapa: comercio, institucional, salud y cultura. «Me encantaban
       esos mapas de calor de varios mapas dependiendo los usos y lo
       institucional» — el institucional por su nombre. */
    T('cada categoría con peso lleva el suyo, el institucional entre ellas',
      cat.length >= 4 && cat.some(m => /institucional/i.test(m.id)),
      cat.map(m => m.t).join(' · ') || 'ninguno');
    T('y el de todos los usos sigue siendo el grande de la banda',
      !!todos && cat.every(m => menor(todos) >= menor(m)),
      (todos ? menor(todos) : 0) + ' mm contra ' + cat.map(m => menor(m)).join(' · '));

    console.log('\n  -- ' + nom + ': baldosas de cifra --');
    /* Sobre la hoja COMPLETA: qué caja es baldosa y cuánto mide es cosa de
       la composición; si la impresa la trae o la declara lo comprueba el
       invariante de abajo. */
    const oc = VC || o;
    /* Contra un mapa de DOS columnas —el de todos los usos, la cobertura,
       los llenos—, que es «un mapa» en la frase que se pidió. Los de una
       columna valen dos pistas y no cuatro. */
    const anchos = ['calor:todos', 'cobertura', 'llenos', 'alturas'];
    const mapaChico = oc.mapas.filter(m => anchos.indexOf(m.id) >= 0)
      .slice().sort((a, b) => a.cajaW - b.cajaW)[0];
    const nombres = oc.cifras.map(c => c.t);
    /* Las dos cajas de puras cifras de este sector, por su nombre: la regla
       se prueba sobre cajas concretas y no sobre «alguna». El espacio
       público —tres cifras, el parque y la meta— y el verde y el agua. La de
       infraestructura de servicios NO es baldosa aunque tenga dos cifras:
       lleva una advertencia larga a propósito («esto NO es la cobertura de
       servicios públicos»), y una advertencia no cabe en media columna. */
    T('las dos cajas de puras cifras salen como baldosas',
      nombres.indexOf('Verde y agua') >= 0 && nombres.indexOf('Espacio público efectivo') >= 0,
      nombres.join(' · ') || 'ninguna');
    T('y la de infraestructura, con su advertencia larga, no',
      nombres.indexOf('Infraestructura de servicios') === -1);
    T('y la ficha del sitio, que abre la hoja al lado del plano, no',
      nombres.indexOf('El sitio') === -1 && oc.cifras.every(c => !c.svg),
      oc.cifras.filter(c => c.svg).map(c => c.t).join(' · ') || 'ninguna con dibujo');
    /* «Cuatro en el ancho de un mapa» se mide sobre la pista: una baldosa
       es UNA pista donde una caja son dos, y un mapa de análisis mide al
       menos cuatro. Lo que mide cada baldosa en el papel depende de la
       banda en que cayó —las de una banda sola en su fila se estiran—, así
       que se comprueba la pista nominal contra el mapa más angosto y, en
       cada banda con caja vecina, que la baldosa valga la mitad. */
    T('cuatro pistas caben en el ancho del mapa de análisis más angosto',
      oc.cifras.length >= 2 && !!mapaChico && 4 * oc.unidad <= mapaChico.cajaW * 1.04,
      Math.round(4 * oc.unidad) + ' px de cuatro pistas contra ' + (mapaChico ? mapaChico.cajaW : 0) + ' del mapa');
    T('y cada baldosa vale la mitad de la caja entera de su banda',
      oc.cifras.filter(c => c.vecina).length >= 1 && oc.cifras.filter(c => c.vecina).every(c => c.w <= c.vecina * 0.55),
      oc.cifras.filter(c => c.vecina).map(c => c.t.split(' ')[0] + ' ' + Math.round(100 * c.w / c.vecina) + '%').join(' · ') || 'ninguna con vecina');
    T('y ninguna se recorta por dentro', oc.cifras.every(c => !c.recortada),
      oc.cifras.filter(c => c.recortada).map(c => c.t).join(' · ') || 'ninguna');

    console.log('\n  -- ' + nom + ': cada banda pregunta y concluye --');
    const sinP = o.bandas.filter(b => !/^¿.+\?$/.test(b.pregunta.trim()));
    const sinC = o.bandas.filter(b => b.cierre.replace(/^Conclusión/, '').trim().length < 30);
    T('hay bandas, y varias', o.bandas.length >= 5, o.bandas.length + ' bandas');
    T('todas abren con una pregunta entre signos', o.bandas.length >= 5 && sinP.length === 0,
      sinP.map(b => b.t).join(' · ') || o.bandas[0].pregunta);
    T('y todas cierran con una conclusión de al menos una línea', o.bandas.length >= 5 && sinC.length === 0,
      sinC.map(b => b.t).join(' · ') || (o.bandas[o.bandas.length - 2] || {}).cierre.slice(0, 90));
    T('la cabecera dice cómo se lee la hoja', /Cómo se lee/.test(o.leeAsi) && /01 → \d\d/.test(o.leeAsi) && /decide/.test(o.leeAsi),
      o.leeAsi.slice(0, 80));

    console.log('\n  -- ' + nom + ': el cierre son cinco propuestas --');
    const c = o.cierre;
    T('la síntesis está', !!c);
    if (!c) return;
    T('ya no es la FODA: son exactamente cinco propuestas', !c.foda && c.filas.length === 5,
      c.filas.length + ' filas' + (c.foda ? ' y todavía hay FODA' : ''));
    T('cada una con necesidad y factibilidad en alta, media o baja',
      c.filas.length === 5 && c.filas.every(f => /^(alta|media|baja)$/.test(f.necNivel) && /^(alta|media|baja)$/.test(f.facNivel)),
      c.filas.map(f => f.necNivel[0] + '/' + f.facNivel[0]).join(' '));
    T('ordenadas por necesidad, de mayor a menor',
      c.filas.length === 5 && c.filas.every((f, i) => i === 0 || f.nec <= c.filas[i - 1].nec),
      c.filas.map(f => f.nec).join(' ≥ '));
    T('cada una nombra el lote concreto, con sus metros',
      c.filas.length === 5 && c.filas.every(f => /lote de [\d.]+ m²/.test(f.facTexto)) && /lote de [\d.]+ m²/.test(c.objeto),
      c.objeto);
    T('y da su razón en una línea', c.filas.every(f => f.razon.trim().length >= 25),
      (c.filas[0] || {}).razon.slice(0, 80));
    T('la nota dice que la norma no está consultada y que la decisión es humana',
      /norma urbana no está consultada/.test(c.nota) && /deciden/.test(c.nota));
    T('la caja mide lo que su contenido: sin papel muerto ni recorte',
      c.sobra <= 6 && !c.recortada, 'sobran ' + c.sobra + ' mm' + (c.recortada ? ' · RECORTADA' : ''));
    T('la primera propuesta impresa es la primera calculada',
      !!r.propuestas && c.filas[0].uso === r.propuestas.propuestas[0].uso, c.filas[0].uso);
  });

  /* ── Tanda 2 (v848): la capa educativa y los paneles de campo ─────── */
  console.log('\n  -- cada panel dice su método --');
  const ETQ = ['Fórmula', 'Fuente', 'Confiabilidad', 'Referencia', 'Error típico'];
  const sinMetodo = (VC.metodos || []).filter(m => !ETQ.every(e => m.etiquetas.indexOf(e) >= 0));
  T('todas las cajas y los mapas de la hoja completa llevan las cinco etiquetas del método',
    (VC.metodos || []).length >= 20 && sinMetodo.length === 0,
    (VC.metodos || []).length + ' paneles' + (sinMetodo.length ? ' · sin método: ' + sinMetodo.map(m => m.t).join(', ') : ''));
  const genericos = (VC.metodos || []).filter(m => /método no descrito todavía/.test(m.texto));
  T('y ninguno con el aviso genérico: cada uno tiene su fórmula y su fuente escritas',
    genericos.length === 0, genericos.map(m => m.t).join(' · ') || 'todos descritos');
  T('la fuente lleva la fecha de la consulta cuando el dato se lee en vivo',
    (VC.metodos || []).some(m => /OpenStreetMap[^·]*\d{1,2}\/\d{1,2}\/\d{4}/.test(m.texto)),
    (((VC.metodos || []).filter(m => /OpenStreetMap/.test(m.texto))[0] || {}).texto || 'ninguno con fecha').slice(0, 120));
  T('y el ruido dice que no es una medición, con su límite normativo',
    (VC.metodos || []).some(m => /ruido/i.test(m.t) && /no es una medición/.test(m.texto) && /627 de 2006/.test(m.texto)));

  console.log('\n  -- el radio lo elige quien analiza, y se lee a tres radios --');
  T('la ficha del sitio dice el radio de análisis y quién lo definió',
    !!VC.radios && /Radio de análisis: [\d.]+ m, definido por quien analiza/.test(VC.radios.texto),
    VC.radios ? VC.radios.texto.slice(0, 90) : 'sin bloque');
  T('con las tres lecturas, 500, 800 y 1.000 m, y la conclusión de si cambia lo que manda',
    !!VC.radios && VC.radios.filas === 3 && /500 m/.test(VC.radios.texto) && /1000 m/.test(VC.radios.texto) &&
    /(cambia con el radio|no cambia con el radio)/.test(VC.radios.texto),
    VC.radios ? VC.radios.filas + ' filas' : '');
  T('el mapa de lo que se alcanza a pie lleva el radio recto superpuesto a la isócrona',
    !!VC.caminar && /Radio de análisis · [\d.]+ m/.test(VC.caminar.conv) && /la traza le quita/.test(VC.caminar.pie) && VC.caminar.poligonos >= 1,
    VC.caminar ? VC.caminar.poligonos + ' polígonos · ' + VC.caminar.conv.slice(-60) : 'sin mapa');

  console.log('\n  -- bibliografía, lectura propia y paneles de campo --');
  [['parada', V, r.fueraV || []], ['acostada', HZ, r.fuera || []]].forEach(([nom, o, fuera]) => {
    if (!o) return;
    T(nom + ': la bibliografía va al pie, con normas y autores',
      o.biblio.n >= 10 && /OpenStreetMap/.test(o.biblio.texto) && /DANE/.test(o.biblio.texto) && /NSR-10/.test(o.biblio.texto) &&
      /1077 de 2015/.test(o.biblio.texto) && /Lynch/.test(o.biblio.texto) && /Jacobs/.test(o.biblio.texto) && /Gehl/.test(o.biblio.texto) &&
      /Ley 388 de 1997/.test(o.biblio.texto),
      o.biblio.n + ' entradas');
    T(nom + ': el cierre deja renglones para la lectura propia, de al menos 18 mm de papel',
      !!o.propia && o.propia.alto >= 18 && /Tu lectura/.test(o.propia.texto) && /a mano/.test(o.propia.texto),
      o.propia ? o.propia.alto + ' mm' : 'sin espacio');
    const nombresCampo = o.campo.map(c => c.t);
    const PANELES = ['Percepción del lugar', 'Lo que no cambia', 'Voces de quien vive acá'];
    const IDS_PANEL = ['percepcion-del-lugar', 'lo-que-no-cambia', 'voces-de-quien-vive-aca'];
    /* Parada —el formato del pliego educativo— los tres paneles no ceden.
       Acostada, con 300 mm menos, ceden los últimos y quedan declarados. */
    T(nom + (nom === 'parada' ? ': los tres paneles de campo están impresos, integrados en su banda' : ': los paneles de campo están impresos o declarados fuera'),
      nom === 'parada' ? PANELES.every(x => nombresCampo.indexOf(x) >= 0)
                       : PANELES.every((x, i) => nombresCampo.indexOf(x) >= 0 || fuera.indexOf(IDS_PANEL[i]) >= 0),
      nombresCampo.join(' · ') || 'ninguno impreso');
    T(nom + ': cada uno impreso trae su instrucción y sitio para escribir, de al menos 45 mm de papel',
      (nom !== 'parada' || o.campo.length === 3) && o.campo.every(c => c.alto >= 45 && c.instruccion.length >= 40 && (c.casillas >= 3 || c.renglones)),
      o.campo.map(c => c.t.split(' ')[0] + ' ' + c.alto + 'mm/' + (c.casillas || 'r')).join(' · ') || 'ninguno impreso');
  });

  /* ── Tanda 3 (v849): los vacíos obligatorios y los cruces ──────────── */
  console.log('\n  -- los cinco vacíos obligatorios, impresos aunque no haya dato --');
  const VACIOS = [
    ['Riesgo oficial', /POT|Decreto 1807/],
    ['Servicios públicos', /DANE|empresa prestadora/],
    ['Norma urbana', /POT|curaduría/],
    ['Movilidad real', /secretaría de movilidad|empresa de transporte/],
    ['Información legal del predio', /tradición y libertad|IGAC|catastro/]
  ];
  [['parada', V, true], ['acostada', HZ, false], ['completa', VC, true]].forEach(([nom, o, exige]) => {
    if (!o) return;
    const nombres = o.vacios.map(v => v.t);
    T(nom + (exige ? ': los cinco están impresos' : ': los que están, están enteros'),
      exige ? VACIOS.every(([t]) => nombres.indexOf(t) >= 0) : true, nombres.join(' · ') || 'ninguno');
    const IDS_VACIO = ['riesgo-oficial', 'servicios-publicos', 'norma-urbana', 'movilidad-real', 'informacion-legal-del-predio'];
    const fueraDe = nom === 'acostada' ? (r.fuera || []) : (r.fueraV || []);
    /* Acostada pueden haber cedido (con 300 mm menos de alto); entonces
       tienen que estar declarados, los cinco, por su nombre. */
    T(nom + ': cada uno dice «sin dato oficial disponible», nombra la fuente que haría falta y qué es lo que sí hay' + (exige ? '' : ', o está declarado fuera'),
      o.vacios.length > 0
        ? o.vacios.every(v => /^Sin dato oficial disponible$/.test(v.tag.trim()) && /Haría falta/.test(v.falta) &&
            (VACIOS.filter(([t]) => t === v.t)[0] || [null, /./])[1].test(v.falta) && /Lo que hay no es eso/.test(v.hay) && v.renglon)
        : (!exige && IDS_VACIO.every(id => fueraDe.indexOf(id) >= 0)),
      o.vacios.length ? o.vacios.map(v => v.t.split(' ')[0] + ':' + ((VACIOS.filter(([t]) => t === v.t)[0] || [null, /./])[1].test(v.falta) ? 'fuente' : 'SIN FUENTE')).join(' · ')
                      : 'ninguno impreso · declarados: ' + IDS_VACIO.filter(id => fueraDe.indexOf(id) >= 0).length + ' de 5');
    T(nom + ': ninguno deduce el riesgo de la pendiente ni dice «sin datos»',
      o.vacios.every(v => !/sin datos/i.test(v.texto)) && o.vacios.filter(v => /Riesgo/.test(v.t)).every(v => /no se deduce de la pendiente/.test(v.texto)));
  });

  console.log('\n  -- lo que dicen juntas las cifras --');
  const CR = (VC.cruces || []);
  const CLAVES = ['Cobertura de equipamientos', 'Espacio público', 'Potencial edificatorio', 'Mezcla de usos', 'Continuidad del tejido',
                  'Suelo disponible', 'Presión de crecimiento', 'Dependencia de acceso', 'Tamaño y forma de predios', 'Comparación con la ciudad', 'Horizonte temporal'];
  T('los once cruces están en el cierre, cada uno con valor y lectura',
    CLAVES.every(k => CR.some(c => c.k === k)) && CR.every(c => c.v.trim().length >= 6 && c.l.trim().length >= 25),
    CR.length + ' cruces · faltan: ' + (CLAVES.filter(k => !CR.some(c => c.k === k)).join(', ') || 'ninguno'));
  const cobEq = CR.filter(c => c.k === 'Cobertura de equipamientos')[0] || { v: '', l: '' };
  T('la cobertura de equipamientos se cuenta en personas servidas y lejos', /hab\. servidos/.test(cobEq.v) && /lejos/.test(cobEq.v), cobEq.v.slice(0, 90));
  T('el potencial edificatorio dice que la altura permitida no tiene dato oficial y no lo inventa',
    /altura permitida: sin dato oficial/.test((CR.filter(c => c.k === 'Potencial edificatorio')[0] || { v: '' }).v));
  T('y la mezcla de usos cierra en decisión de diseño',
    /primer piso|vivienda|planta baja/.test((CR.filter(c => c.k === 'Mezcla de usos')[0] || { l: '' }).l));
  T('la presión de crecimiento dice que la serie no está leída cuando no lo está, en vez de callar',
    /serie satelital no leída|puntos de verde|estable/.test((CR.filter(c => c.k === 'Presión de crecimiento')[0] || { v: '', l: '' }).v + ' ' + (CR.filter(c => c.k === 'Presión de crecimiento')[0] || { l: '' }).l));

  console.log('\n  -- cada dato ambiental cierra en una decisión --');
  const DEC = VC.decisiones || [];
  T('al menos cuatro cajas ambientales de la hoja completa cierran con «→ decisión»',
    DEC.length >= 4 && DEC.every(d => /^→ /.test(d.texto.trim()) && d.texto.trim().length >= 40),
    DEC.map(d => d.t.split(' ').slice(0, 2).join(' ')).join(' · ') || 'ninguna');
  T('la de la cobertura del suelo habla de permeabilidad o de calor, salida de su propio número',
    DEC.some(d => /Cobertura del suelo/.test(d.t) && /permeab|calor/.test(d.texto)),
    DEC.map(d => d.t + ': ' + d.texto.slice(0, 40)).join(' | '));

  console.log('\n  -- lo que cede queda dicho --');
  // El identificador con el que la ficha declara una caja: su título en minúsculas, sin tildes, con guiones.
  const slugDe = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ · el mapa$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const panelesDe = h => (h.match(/<section class="caja[^"]*"[^>]*><h2>[^<]+<\/h2>/g) || []).map(x => {
    const m = x.match(/data-m="([^"]+)"/); return m ? m[1] : slugDe((x.match(/<h2>([^<]+)/) || [])[1] || ''); });
  const compuestos = panelesDe(r.completa || ''), impresos = panelesDe(r.v || '');
  const perdidos = compuestos.filter(id => impresos.indexOf(id) < 0 && (r.fueraV || []).indexOf(id) < 0);
  /* Desde v850 el canje cambió de lado: lo que cede son PANELES DE TEXTO
     y nunca un mapa. Entre v847 y v849 era al revés —los mapas se
     apagaban para guardarse sus 120 mm— y de ahí vino la queja. Los mapas
     tienen su propia lista, `pliegoMapasOff`; que ninguno esté en la de
     fuera es la comprobación de que la regla nueva se cumple. */
  const IDS_MAPA = ['foto', 'cobertura', 'llenos', 'alturas', 'vias', 'hitos', 'caminar', 'llega',
                    'comercial', 'anillos', 'ruido', 'sombras', 'sombra-proyecto', 'curvas', 'masa',
                    'agua', 'estratos', 'caminata', 'acuerdos', 'intangible'];
  const mapasFuera = (r.fueraV || []).filter(id => IDS_MAPA.indexOf(id) >= 0 || /^calor:/.test(id));
  T('la hoja de fábrica no sacrifica ni un mapa: lo que cede es texto',
    mapasFuera.length === 0,
    'fuera: ' + ((r.fueraV || []).join(', ') || 'nada') +
    (mapasFuera.length ? ' · MAPAS CEDIDOS: ' + mapasFuera.join(', ') : ''));
  T('y nada de lo que cediera faltaría sin estar declarado por su nombre', perdidos.length === 0,
    (r.fueraV || []).length + ' declarados' + (perdidos.length ? ' · PERDIDOS: ' + perdidos.join(', ') : ''));

  console.log('\n  -- las categorías que cambian la conclusión --');
  const cats = r.categorias || [];
  T('son como mucho dos, y cada una dice por qué está',
    cats.length >= 1 && cats.length <= 2 && cats.every(x => /manda|concentrada|segunda en peso/.test(x.razon || '')),
    cats.map(x => x.id + ': ' + x.razon).join(' · '));
  T('la primera es la que manda', !!cats[0] && /^manda/.test(cats[0].razon || ''));

  console.log('\n  ' + (mal ? mal + ' comprobaciones fallaron' : 'todo en verde'));
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
