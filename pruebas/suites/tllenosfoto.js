const E = require('../entorno.js');
/* Los llenos y vacíos, leídos de la foto.

   La queja, con la captura del mapa encima: «8,2 % construido · 976 huellas»,
   y en la foto media docena de manzanas llenas de casas sin una sola huella
   dibujada. «Aún hay manzanas que no lee.» Los llenos salían de contar los
   polígonos que OpenStreetMap tiene mapeados, y eso no mide el barrio: mide
   cuánto lo han mapeado.

   Lo que se prueba acá no se puede probar con una foto de verdad —no se sabe
   cuánto hay construido en una foto de verdad, que es justamente el problema—
   así que se fabrica una: un damero donde se sabe, metro a metro, qué es
   techo y qué no.

     · manzanas de casas de TEJA (naranja), todas iguales;
     · calles de asfalto GRIS entre ellas;
     · dos parques VERDES;
     · y un lote pelado de TIERRA, del mismo color que la teja vieja, que es
       el error que esta lectura no puede evitar y que la ficha declara.

   A la aplicación se le dan como «huellas mapeadas» solo las casas de UNA
   manzana. Lo que tiene que hacer es aprender de esa manzana el color del
   techo y encontrar las otras cuatro, que es lo que se pidió.               */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';

/* La escena, en metros sobre una caja de 400 × 400 m.
   Cinco manzanas de 120 × 70 m con casas de 10 × 8, calles de 14 m, dos
   parques y un lote pelado. Se dibuja en un lienzo y se le pasa a la
   aplicación como si fuera la foto satelital ya clasificada. */
const LADO_M = 400, PX = 400;                 // 1 m por píxel
const C = { lat: 7.8939, lng: -72.5078 };
const GLAT = m => m / 110540, GLNG = m => m / (111320 * Math.cos(C.lat * Math.PI / 180));

// Casas: filas de manzanas. Cada casa es un rectángulo en metros (x, y desde
// la esquina noroeste de la caja).
const CASAS = [];
const MANZANAS = [
  { x: 20, y: 20 }, { x: 160, y: 20 }, { x: 20, y: 120 }, { x: 160, y: 120 }, { x: 20, y: 220 }
];
MANZANAS.forEach((m, im) => {
  for (let f = 0; f < 6; f++) {
    for (let c = 0; c < 2; c++) {
      CASAS.push({ x: m.x + f * 19, y: m.y + c * 30, w: 15, h: 24, manzana: im });
    }
  }
});
const PARQUES = [{ x: 300, y: 40, w: 80, h: 90 }, { x: 300, y: 200, w: 70, h: 80 }];
const PELADO = { x: 60, y: 320, w: 120, h: 60 };

// De metros a coordenadas: la caja va de (norte, oeste) a (sur, este).
const caja = {
  n: C.lat + GLAT(LADO_M / 2), s: C.lat - GLAT(LADO_M / 2),
  o: C.lng - GLNG(LADO_M / 2), e: C.lng + GLNG(LADO_M / 2)
};
const aLatLng = (x, y) => ({ lat: caja.n - GLAT(y), lng: caja.o + GLNG(x) });
const rectALatLng = r => [aLatLng(r.x, r.y), aLatLng(r.x + r.w, r.y),
                          aLatLng(r.x + r.w, r.y + r.h), aLatLng(r.x, r.y + r.h)];

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 },
    isMobile: true, hasTouch: true });
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 160)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => !!window.URBIS_LLENOS_FOTO, null, { timeout: 20000 });

  const r = await pg.evaluate(async (D) => {
    const { CASAS, PARQUES, PELADO, caja, PX, LADO_M } = D;
    // ── La foto de mentira y su clasificación, con los mismos códigos de js/24.
    const cv = document.createElement('canvas'); cv.width = PX; cv.height = PX;
    const x = cv.getContext('2d');
    const cls = new Uint8Array(PX * PX);
    const marcar = (rx, ry, rw, rh, cod) => {
      for (let py = Math.round(ry); py < Math.round(ry + rh); py++) {
        for (let px2 = Math.round(rx); px2 < Math.round(rx + rw); px2++) {
          if (px2 < 0 || py < 0 || px2 >= PX || py >= PX) continue;
          cls[py * PX + px2] = cod;
        }
      }
    };
    // Asfalto de fondo: gris neutro, código «construido» de js/24 (2).
    x.fillStyle = '#6e7276'; x.fillRect(0, 0, PX, PX);
    cls.fill(2);
    // Parques: verde (1).
    x.fillStyle = '#2f7d32';
    PARQUES.forEach(p => { x.fillRect(p.x, p.y, p.w, p.h); marcar(p.x, p.y, p.w, p.h, 1); });
    /* El lote pelado y las casas comparten el rango cálido: en js/24 es la
       clase «mixto» (4), la que está declarada como no separable por color.
       Con un ruido pequeño para que no sea un color plano irreal. */
    const calido = (rx, ry, rw, rh, base) => {
      for (let py = Math.round(ry); py < Math.round(ry + rh); py++) {
        for (let px2 = Math.round(rx); px2 < Math.round(rx + rw); px2++) {
          const n = (Math.sin(px2 * 12.9898 + py * 78.233) * 43758.5453) % 1;
          const d = Math.round(n * 14);
          x.fillStyle = 'rgb(' + (base[0] + d) + ',' + (base[1] + d) + ',' + (base[2] + d) + ')';
          x.fillRect(px2, py, 1, 1);
        }
      }
      marcar(rx, ry, rw, rh, 4);
    };
    calido(PELADO.x, PELADO.y, PELADO.w, PELADO.h, [150, 118, 86]);   // tierra
    CASAS.forEach(c => calido(c.x, c.y, c.w, c.h, [176, 84, 52]));    // teja
    const m2PorPixel = (LADO_M / PX) * (LADO_M / PX);
    const raster = { imagen: cv.toDataURL('image/png'), mPorPx: LADO_M / PX,
      rejilla: { cls: cls, W: PX, H: PX, caja: caja, m2PorPixel: m2PorPixel } };

    // ── Solo las casas de UNA manzana se dan como mapeadas.
    const huellas = D.huellasManzana0;
    const vias = D.vias;
    const t0 = Date.now();
    const res = await window.URBIS_LLENOS_FOTO.estimar({ raster, huellas, vias });
    res.ms = Date.now() - t0;
    // Lo que de verdad hay construido en la escena, para comparar.
    res.realPct = Math.round(1000 * (CASAS.length * 15 * 24) / (LADO_M * LADO_M)) / 10;
    res.casas = CASAS.length;
    return res;
  }, {
    CASAS, PARQUES, PELADO, caja, PX, LADO_M,
    huellasManzana0: CASAS.filter(c => c.manzana === 0).map(rectALatLng),
    // Una calle horizontal y una vertical, de las de verdad.
    vias: [
      { clase: 'residential', pts: [aLatLng(0, 105), aLatLng(400, 105)] },
      { clase: 'residential', pts: [aLatLng(150, 0), aLatLng(150, 400)] }
    ]
  });
  const errores = err;
  await pg.close(); await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

  console.log('\n  -- la escena --');
  console.log('  (' + r.casas + ' casas, ' + r.realPct + '% del suelo construido de verdad; ' +
    'mapeadas solo las 12 de una manzana)');

  console.log('\n  -- se lee --');
  T('devuelve una estimación', r.ok === true, r.ok ? '' : (r.detalle || r.motivo));
  T('en menos de diez segundos', r.ms < 10000, r.ms + ' ms');

  console.log('\n  -- y encuentra las manzanas que nadie mapeó --');
  /* Lo mapeado es una manzana de cinco: el 20 % de las casas. Si la lectura
     solo devolviera eso, no habría servido para nada. */
  T('lo mapeado era una quinta parte', r.pctOSM > 0 && r.pctOSM < r.realPct * 0.35,
    r.pctOSM + '% con huella, de ' + r.realPct + '% real');
  T('la foto encuentra el resto', r.pct >= r.realPct * 0.75,
    r.pct + '% leído contra ' + r.realPct + '% real');
  /* Y no se pasa: el lote pelado tiene el color de la teja y algo se cuela,
     pero la cifra no puede irse al doble de lo que hay. */
  T('sin inventarse una ciudad que no está', r.pct <= r.realPct * 1.6,
    r.pct + '% leído contra ' + r.realPct + '% real');
  T('y dice cuánto falta por mapear', r.pctSinMapear > 0 &&
    Math.abs(r.pctSinMapear - (r.pct - r.pctOSM)) < 0.2, r.pctSinMapear + '% sin mapear');

  console.log('\n  -- y lo dice con honestidad --');
  T('trae la confianza de la separación', typeof r.confianza === 'number' && r.confianza > 0,
    r.confianza + '%');
  T('y con cuántas huellas se calibró', r.huellas === 12, r.huellas + ' huellas');
  T('deja una máscara para verla en el mapa',
    /^data:image\/png;base64,/.test(r.imagen || '') && Array.isArray(r.limites));

  console.log('\n  -- sin nada mapeado, no se inventa --');
  const solo = await (async () => {
    const b2 = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
    const c2 = await b2.newContext({ serviceWorkers: 'block' });
    await c2.route('**', rr => /localhost:(8199|8787)/.test(rr.request().url()) ? rr.continue() : rr.abort());
    await c2.route(/unpkg\.com/, rr => { const u = rr.request().url();
      rr.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
        body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
    await c2.route(/script\.google\.com/, rr => rr.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await c2.route(/cdn\.jsdelivr\.net/, rr => rr.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    const p2 = await c2.newPage();
    await p2.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
    await p2.waitForFunction(() => !!window.URBIS_LLENOS_FOTO, null, { timeout: 20000 });
    const out = await p2.evaluate(async (D) => {
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200;
      const x = cv.getContext('2d'); x.fillStyle = '#8a6a4a'; x.fillRect(0, 0, 200, 200);
      const cls = new Uint8Array(200 * 200); cls.fill(4);
      return await window.URBIS_LLENOS_FOTO.estimar({
        raster: { imagen: cv.toDataURL('image/png'), mPorPx: 1,
          rejilla: { cls, W: 200, H: 200, caja: D.caja, m2PorPixel: 1 } },
        huellas: [], vias: []
      });
    }, { caja });
    await b2.close(); return out;
  })();
  T('lo dice en vez de devolver un número', solo.ok === false && solo.motivo === 'pocasHuellas',
    solo.motivo || 'devolvió ' + solo.pct + '%');
  T('y explica qué hacer', /Medí el trazado|mapeá/.test(solo.detalle || ''), solo.detalle || '');

  console.log('');
  T('sin errores de JavaScript', errores.length === 0, errores.join(' | ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
