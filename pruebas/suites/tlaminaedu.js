const E = require('../entorno.js');
/* LA LÁMINA EDUCATIVA · tanda 1: diagramación, cierre y pregunta por banda

   Llegó como un pliego de instrucciones para el módulo educativo —la lámina
   de 60 × 90 que un estudiante entrega a un jurado— y esta suite mide la
   primera tanda, con estas reglas escritas:

     · «Un mapa: mínimo 12 cm de lado corto, NUNCA menos. Si no cabe, se
        quita otro panel, no se encoge el mapa.»
     · «Los ocho mapas de usos: UN mapa grande y mapas pequeños de
        comparación solo para las categorías que cambian la conclusión.»
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
            comp: c.classList.contains('mapa-comp'), w: mm(rb.width), h: mm(rb.height),
            cajaW: c.offsetWidth };
        }),
        /* La capa de método de cada caja y de cada mapa: las cinco etiquetas. */
        metodos: [...document.querySelectorAll('.caja:not(.caja-campo)')].map(c => ({
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
        campo: [...document.querySelectorAll('.caja-campo')].map(c => ({
          t: (c.querySelector('h2') || {}).textContent || '?', alto: mm(rect(c).height),
          casillas: c.querySelectorAll('.cf').length, renglones: !!c.querySelector('.renglones'),
          instruccion: (c.querySelector('.lee') || {}).textContent || '' })),
        cifras: [...document.querySelectorAll('.caja-cifra')].map(c => ({
          t: (c.querySelector('h2') || {}).textContent || '?', w: c.offsetWidth,
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
    console.log('\n  -- ' + nom + ': los mapas no bajan de 120 mm --');
    if (!o) { T('la lámina se pudo montar', false); return; }
    const analisis = o.mapas.filter(m => !m.comp), comp = o.mapas.filter(m => m.comp);
    const menor = m => Math.min(m.w, m.h);
    const chicos = analisis.filter(m => menor(m) < 119.5);
    /* Cuatro figuras no ceden nunca: la foto, el plano, la cobertura y el
       mapa de todos los usos. Desde v848 los paneles de campo tampoco, y el
       tercer mapa del núcleo puede cederles el sitio. */
    T('hay mapas de análisis que medir: al menos las cuatro figuras que no ceden', analisis.length >= 4,
      analisis.length + ' de análisis · ' + comp.length + ' de comparación');
    T('ninguno de análisis baja de 120 mm de lado corto, con la hoja ya reducida',
      analisis.length >= 4 && chicos.length === 0,
      chicos.length ? chicos.map(m => m.t + ' ' + m.w + '×' + m.h).join(' · ')
                    : 'el más chico ' + Math.min.apply(null, analisis.map(menor)) + ' mm · compuesta al ' + Math.round(o.escala * 100) + '%');
    T('y la hoja cierra igual: no se desborda',
      o.pide <= o.papel + 2, o.pide + ' de ' + o.papel + ' mm');

    console.log('\n  -- ' + nom + ': un mapa grande de usos y los de comparación --');
    const todos = o.mapas.filter(m => m.id === 'calor:todos')[0];
    const cat = o.mapas.filter(m => /^calor:/.test(m.id) && m.id !== 'calor:todos');
    T('el de todos los usos está y es de análisis, no de comparación', !!todos && !todos.comp);
    /* Como mucho dos; en la hoja acostada pueden haber cedido su sitio a
       las cajas de análisis, y eso está bien: ceden antes que ellas. */
    T('los de categoría son como mucho dos, y van marcados como comparación',
      cat.length <= 2 && cat.every(m => m.comp), cat.map(m => m.t).join(' · ') || 'ninguno');
    T('y el grande es de verdad más grande que cada uno de ellos',
      !!todos && (cat.length === 0 || cat.every(m => menor(todos) >= 1.5 * menor(m))),
      (todos ? menor(todos) : 0) + ' mm contra ' + cat.map(m => menor(m)).join(' · '));

    console.log('\n  -- ' + nom + ': baldosas de cifra --');
    /* Sobre la hoja COMPLETA: qué caja es baldosa y cuánto mide es cosa de
       la composición; si la impresa la trae o la declara lo comprueba el
       invariante de abajo. */
    const oc = VC || o;
    const mapaChico = oc.mapas.filter(m => !m.comp).slice().sort((a, b) => a.cajaW - b.cajaW)[0];
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
    T('cuatro caben en el ancho del mapa de análisis más angosto',
      oc.cifras.length >= 2 && !!mapaChico && oc.cifras.every(c => 4 * c.w <= mapaChico.cajaW * 1.04),
      oc.cifras.length ? Math.round(Math.max.apply(null, oc.cifras.map(c => c.w)) / (mapaChico ? mapaChico.cajaW : 1) * 100) + '% del ancho del mapa cada una' : '');
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

  console.log('\n  -- lo que cede queda dicho --');
  // El identificador con el que la ficha declara una caja: su título en minúsculas, sin tildes, con guiones.
  const slugDe = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ · el mapa$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const panelesDe = h => (h.match(/<section class="caja[^"]*"[^>]*><h2>[^<]+<\/h2>/g) || []).map(x => {
    const m = x.match(/data-m="([^"]+)"/); return m ? m[1] : slugDe((x.match(/<h2>([^<]+)/) || [])[1] || ''); });
  const compuestos = panelesDe(r.completa || ''), impresos = panelesDe(r.v || '');
  const perdidos = compuestos.filter(id => impresos.indexOf(id) < 0 && (r.fueraV || []).indexOf(id) < 0);
  T('la hoja completa trae más paneles que la impresa: el papel cedió algo', compuestos.length > impresos.length,
    compuestos.length + ' compuestos · ' + impresos.length + ' impresos');
  T('y nada de lo que cedió falta sin estar declarado por su nombre', perdidos.length === 0 && (r.fueraV || []).length >= compuestos.length - impresos.length,
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
