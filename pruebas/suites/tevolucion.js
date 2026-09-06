const E = require('../entorno.js');
/* La evolución del sitio, año por año.

   Se pidió mirar cómo cambió el lote y su contexto a través de los años, con
   imágenes satelitales, y llegar a una conclusión ambiental e hídrica.

   Lo que esta prueba vigila es lo que puede romperse en silencio y arruinar la
   conclusión sin que nada se vea mal:

     · Que se MIDA lo que se dice que se mide. La serie larga se lee con NDVI
       —el índice de la banda infrarroja— y no con el clasificador de colores
       de la foto de hoy. Se le dan imágenes de índice conocidas y se
       comprueba el número exacto que tienen que dar.
     · Que un hueco no cuente como agua. Landsat 7 dejó franjas sin dato desde
       2003 y el borde de una escena llega transparente: contarlos como cero
       los volvería agua y la serie diría que apareció un río.
     · Que un año medio tapado no entre en la conclusión, y que igual se vea.
     · Que la tendencia no afirme un cambio que cabe en el error. Dos puntos
       de diferencia a treinta metros no son un cambio, son ruido.
     · Que las dos series NO se mezclen: la de alta resolución no lleva
       porcentajes, porque compararlos con los de Landsat sería comparar dos
       cámaras.

   El servicio no se toca: `URBIS_EVOLUCION_URL` se sustituye por una función
   que devuelve imágenes hechas a mano con la proporción que se quiera. Es a
   propósito —así se prueba la medición y no la red— y es también lo único que
   se puede hacer sin salida a internet.                                     */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const zlib = require('zlib');
/* Un PNG cuadrado de un color, hecho a mano. Hace falta uno DE VERDAD —no un
   pixel transparente ni un SVG— porque lo que se está probando es que las
   teselas se peguen y se recorten bien, y para eso el navegador tiene que
   poder decodificarlas y el lienzo leerlas. */
function pngLiso(n, r, g, b) {
  const fila = Buffer.alloc(1 + n * 3);
  for (let i = 0; i < n; i++) { fila[1 + i * 3] = r; fila[2 + i * 3] = g; fila[3 + i * 3] = b; }
  const cruda = Buffer.concat(Array.from({ length: n }, () => fila));
  const trozo = (tipo, datos) => {
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo) >>> 0);
    return Buffer.concat([largo, cuerpo, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(cruda)), trozo('IEND', Buffer.alloc(0))]);
}
const TABLA_CRC = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t; })();
function crc32(buf) { let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return c ^ -1; }
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.004;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];
const usos = [];
for (let i = 0; i < 30; i++) {
  const a = i * 12 * Math.PI / 180, d = (150 + (i % 4) * 60) / 111320;
  usos.push({ type: 'node', id: 400 + i, lat: C.lat + Math.cos(a) * d, lon: C.lng + Math.sin(a) * d,
    tags: { name: 'Sitio ' + i, amenity: ['pharmacy', 'school', 'bank'][i % 3] } });
}

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
    /* Solo en el marco principal: ver la nota en las demás suites. */
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'urbisprocity', rol: 'admin',
        es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
    } catch (e) {}
  });
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  /* ── El servicio de verdad, apuntado ────────────────────────────────
     Esta es la parte que faltaba y por la que el historial no funcionaba en
     la calle: el adaptador se escribió de memoria y NADIE comprobó nunca la
     dirección que pedía. La primera versión llamaba a
     `.../World_Imagery/MapServer/export?bbox=…&anio=2016`, que en ese
     servidor no existe, y la prueba no lo veía porque sustituía el adaptador
     entero por imágenes de mentira.

     Ahora se deja correr el adaptador REAL y se intercepta la red: se apunta
     cada dirección pedida y se contesta con una tesela hecha a mano. Así se
     comprueba lo único que no se podía comprobar —qué se pide y a dónde— sin
     depender de que Esri conteste. */
  const teselasPedidas = [];
  await ctx.route(/wayback\.maptiles\.arcgis\.com/, r => {
    teselasPedidas.push(r.request().url());
    r.fulfill({ status: 200, contentType: 'image/png',
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: pngLiso(256, 60, 110, 70) });
  });
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route(/locationiq\.com/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ address: { city: 'Cúcuta', state: 'Norte de Santander', country: 'Colombia' } }) }));
  await ctx.route(/overpass/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: usos }) }));
  await ctx.route(/ags\.esri\.co/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ features: [{ attributes: { TOTAL: 3045, N: 42 } }] }) }));

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r = await pg.evaluate(async (D) => {
    const { C, POL } = D, o = {}, esperar = ms => new Promise(x => setTimeout(x, ms));
    const EV = window.URBIS_EVOLUCION;
    o.hayModulo = !!EV;
    if (!EV) return o;

    /* ── Una imagen de índice hecha a mano ────────────────────────────
       El módulo espera un PNG en escala de grises donde el valor del píxel
       mapea linealmente al rango del índice. Acá se arma uno con las
       proporciones que se quieran, y así se puede exigir el número exacto
       en vez de «algo parecido». `hueco` deja transparente una franja, que
       es como llega una escena de Landsat 7 desde 2003. */
    const pinta = (pesos, hueco) => {
      const T = 64;
      const cv = document.createElement('canvas'); cv.width = T; cv.height = T;
      const x = cv.getContext('2d');
      const im = x.createImageData(T, T);
      // De valor de índice a valor de píxel, con rango [-1, 1].
      const px = v => Math.round((v + 1) / 2 * 255);
      const tramos = [];
      let acc = 0;
      // agua = −0,5 · duro = 0,1 · rala = 0,3 · viva = 0,7
      [['agua', -0.5], ['duro', 0.1], ['rala', 0.3], ['viva', 0.7]].forEach(([k, v]) => {
        acc += pesos[k] || 0; tramos.push({ hasta: acc, v: px(v) });
      });
      const total = acc || 1;
      for (let i = 0; i < T * T; i++) {
        const q = (i / (T * T)) * total;
        const t = tramos.find(t2 => q < t2.hasta) || tramos[tramos.length - 1];
        const j = i * 4;
        // Dos de cada tres renglones sin dato: un año medio tapado de verdad.
        // Con uno de cada seis el hueco daba 17 % y el año seguía siendo
        // fiable, así que la prueba no ejercitaba el camino que quería.
        const enHueco = hueco && (Math.floor(i / T) % 3 !== 0);
        im.data[j] = im.data[j + 1] = im.data[j + 2] = t.v;
        im.data[j + 3] = enHueco ? 0 : 255;
      }
      x.putImageData(im, 0, 0);
      return cv.toDataURL('image/png');
    };

    // Una foto en color, para la serie de alta resolución.
    const pintaColor = (c1, c2) => {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      const x = cv.getContext('2d');
      for (let i = 0; i < 64; i += 8) for (let j = 0; j < 64; j += 8) {
        x.fillStyle = ((i + j) / 8) % 2 ? c1 : c2; x.fillRect(i, j, 8, 8);
      }
      return cv.toDataURL('image/png');
    };

    /* El guion de la prueba: un sector que pierde vegetación y gana suelo
       duro entre 1984 y hoy, con un año medio tapado en el medio. */
    const GUION = {
      1984: { agua: 5, duro: 25, rala: 20, viva: 50 },
      1989: { agua: 5, duro: 30, rala: 20, viva: 45 },
      1994: { agua: 4, duro: 38, rala: 20, viva: 38 },
      1999: { agua: 4, duro: 45, rala: 18, viva: 33 },
      2004: { agua: 4, duro: 52, rala: 18, viva: 26, tapado: true },
      2009: { agua: 3, duro: 58, rala: 17, viva: 22 },
      2014: { agua: 3, duro: 62, rala: 16, viva: 19 },
      2019: { agua: 3, duro: 66, rala: 15, viva: 16 },
      2024: { agua: 2, duro: 70, rala: 14, viva: 14 }
    };
    const pedidas = [];
    window.URBIS_EVOLUCION_URL = function (fuente, anio) {
      pedidas.push(fuente + ':' + anio);
      if (fuente === 'wayback') return pintaColor('#4a7f52', '#8b8f7a');
      const g = GUION[anio] || GUION[2024];
      return pinta(g, !!g.tapado);
    };

    // ── La medición sola, sin sector: el número exacto.
    const solo = await (async () => {
      const url = pinta({ agua: 10, duro: 30, rala: 20, viva: 40 }, false);
      const im = await new Promise((ok, no) => {
        const i2 = new Image(); i2.crossOrigin = 'anonymous';
        i2.onload = () => {
          const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
          const cx = cv.getContext('2d'); cx.drawImage(i2, 0, 0, 64, 64);
          ok({ datos: cx.getImageData(0, 0, 64, 64).data, tam: 64 });
        };
        i2.onerror = () => no(new Error('no cargó'));
        i2.src = url;
      });
      return { medida: EV.medirIndice(im, [-1, 1]), hueco: EV.huecoDe(im) };
    })();
    o.medicion = solo;

    // ── Y el hueco no cuenta como agua.
    const conHueco = await (async () => {
      const url = pinta({ agua: 0, duro: 50, rala: 20, viva: 30 }, true);
      const im = await new Promise((ok, no) => {
        const i2 = new Image(); i2.crossOrigin = 'anonymous';
        i2.onload = () => {
          const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
          const cx = cv.getContext('2d'); cx.drawImage(i2, 0, 0, 64, 64);
          ok({ datos: cx.getImageData(0, 0, 64, 64).data, tam: 64 });
        };
        i2.onerror = () => no(new Error('no cargó'));
        i2.src = url;
      });
      return { medida: EV.medirIndice(im, [-1, 1]), hueco: EV.huecoDe(im) };
    })();
    o.conHueco = conHueco;

    // ── La caja del sector, cuadrada.
    const caja = EV.cajaDe(POL);
    o.caja = caja ? { ladoM: caja.ladoM,
      anchoGr: Math.round((caja.e - caja.o) * Math.cos(caja.latC * Math.PI / 180) * 1e6) / 1e6,
      altoGr: Math.round((caja.n - caja.s) * 1e6) / 1e6 } : null;
    o.anios = EV.aniosDe('landsat');

    // ── El sector y la serie, por el camino del dedo.
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    let capturado = '';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function (h) { capturado = h; };
    window.map.setView([C.lat, C.lng], 15); await esperar(400);
    const A = window.URBIS_PC_ANALISIS, R = window.URBIS_PC_RECON;
    const bPC = document.querySelector('[data-u52-call="procity-open-map"]');
    if (bPC) { bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p => A.agregarPunto(p.lat, p.lng)); A.agregarPunto(POL[0].lat, POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);
    const H = () => document.getElementById('pcr-hoja');
    const abrir = async () => { const a = H().querySelector('[data-pcr="agrandar"]');
      if (a) { a.click(); await esperar(400); } };
    await abrir();

    o.hayBoton = !!H().querySelector('[data-pcr="evolucion"]');
    H().querySelector('[data-pcr="evolucion"]').click();
    for (let i = 0; i < 90 && !(H().textContent || '').match(/Desde 1984, medido/); i++) await esperar(400);
    await esperar(500); await abrir();
    const hoja = () => (H().textContent || '').replace(/\s+/g, ' ');
    o.serieEnFicha = /Desde 1984, medido/.test(hoja());
    o.textoFicha = (hoja().match(/Desde 1984, medido[^]{0,1600}/) || [''])[0];
    o.pedidas = pedidas.slice();
    o.tira = H().querySelectorAll('.pcr-evo-tira .pcr-evo-p').length;
    o.dudosos = H().querySelectorAll('.pcr-evo-dudoso').length;

    // Y la serie de alta resolución, que no lleva porcentajes.
    const bAlta = H().querySelector('[data-pcr="evolucion-alta"]');
    if (bAlta) { bAlta.click(); }
    for (let i = 0; i < 90 && !(H().textContent || '').match(/Desde 2014, en alta/); i++) await esperar(400);
    await esperar(500); await abrir();
    o.altaEnFicha = /Desde 2014, en alta/.test(hoja());
    o.textoAlta = (hoja().match(/Desde 2014, en alta[^]{0,320}/) || [''])[0];
    o.tiraAlta = H().querySelectorAll('.pcr-evo-alta .pcr-evo-p').length;
    /* Y CUÁNTO MIDE en pantalla, que es distinto de cuántas hay. La tira se
       corre de lado, así que es un contenedor de scroll; dentro de la columna
       flexible de la ficha eso le quita el tamaño mínimo automático y la
       aplasta a diez píxeles. Estaba en el DOM entero, con sus cinco
       estampas, y en el teléfono se veían tres rebanadas de imagen sin pie:
       contar figuras decía que todo estaba bien. */
    o.geom = (function () {
      var t = H().querySelector('.pcr-evo-alta');
      if (!t) return null;
      var f = t.querySelector('.pcr-evo-p'), im = t.querySelector('img');
      var alto = function (el) { return el ? Math.round(el.getBoundingClientRect().height) : 0; };
      return { tira: alto(t), figura: alto(f), imagen: alto(im),
               anchoImagen: im ? Math.round(im.getBoundingClientRect().width) : 0,
               pie: !!t.querySelector('figcaption'),
               fecha: (t.querySelector('small') || {}).textContent || '' };
    })();

    // ── El papel: los DOS documentos, que es donde se pidió que salieran.
    H().querySelector('[data-pcr="lamina-ver"]').click(); await esperar(1200);
    o.lamina = capturado; capturado = '';
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(1200);
    o.pdf = capturado; capturado = '';

    // ── Y lo que queda archivado.
    o.guardado = (function () {
      try {
        const f = (R.leerFichas() || [])[0] || {};
        const e = f.evo && f.evo.landsat;
        return { hay: !!e, pasos: e ? e.pasos.length : 0,
                 conImagen: e ? e.pasos.filter(p => p.imagen).length : -1,
                 tendencia: !!(e && e.tendencia),
                 pesoKB: Math.round((JSON.stringify(f.evo || {}).length) / 1024) };
      } catch (e2) { return { error: String(e2) }; }
    })();
    return o;
  }, { C, POL });

  /* ── El adaptador REAL, sin sustituir ─────────────────────────────────
     Segunda vuelta: se quita el sustituto y se deja que el módulo arme las
     direcciones él solo. Lo que se mira es qué pide —el patrón de tesela y
     el número de entrega que le toca a cada año— y que con eso sepa pegar y
     recortar una imagen legible. */
  r.real = await pg.evaluate(async (D) => {
    const { POL } = D, o = {};
    const EV = window.URBIS_EVOLUCION;
    if (!EV) return { sinModulo: true };
    delete window.URBIS_EVOLUCION_URL;
    delete window.URBIS_EVOLUCION_TRAER;
    o.entrega2016 = EV.entregaDe(2016);
    o.entrega2020 = EV.entregaDe(2020);
    // Un año sin entrega: tiene que dar el más cercano y DECIR que lo es.
    o.entrega2005 = EV.entregaDe(2005);
    const caja = EV.cajaDe(POL);
    o.zoom = EV.zoomPara(caja, 256);
    try {
      const s2 = await EV.serie({ fuente: 'wayback', caja: caja, anios: [2016, 2020], tam: 64 });
      o.pasos = (s2.pasos || []).map(p => ({ anio: p.anio, ok: !!p.ok, fecha: p.fecha || null,
                                             error: p.error || null,
                                             pinta: !!(p.imagen && p.imagen.length > 200) }));
    } catch (e) { o.error = String(e && e.message); }
    return o;
  }, { C, POL });
  r.teselas = teselasPedidas.slice();

  r.err = err.filter(e => !/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };
  const LAM = r.lamina || '';
  const cajaDe = t => (LAM.split('<section class="caja')
    .filter(x => new RegExp('<h2>' + t + '</h2>').test(x))[0] || '');

  console.log('\n  -- el módulo mide lo que dice medir --');
  T('js/80 carga', r.hayModulo === true);
  const M = (r.medicion || {}).medida || {};
  /* Con 10 % de agua, 30 % duro, 20 % rala y 40 % viva, el índice tiene que
     devolver exactamente eso. Un margen de medio punto por el redondeo de la
     rejilla de 64 × 64. */
  T('el agua da lo que se le puso', Math.abs(M.agua - 10) <= 0.5, M.agua + '%');
  T('el suelo duro también', Math.abs(M.duro - 30) <= 0.5, M.duro + '%');
  T('y el verde es la suma de rala y viva',
    Math.abs(M.verde - 60) <= 0.5 && Math.abs(M.viva - 40) <= 0.5,
    M.verde + '% (viva ' + M.viva + '%)');

  console.log('\n  -- un hueco no es agua --');
  /* Landsat 7 dejó franjas sin dato desde 2003 y el borde de una escena llega
     transparente. Contarlos como cero los volvería agua —el cero está por
     debajo del umbral— y la serie diría que apareció un río donde hay un
     hueco de la imagen. */
  const CH = (r.conHueco || {}).medida || {};
  T('la franja sin dato se cuenta como hueco', (r.conHueco || {}).hueco > 10,
    (r.conHueco || {}).hueco + '% de hueco');
  T('y NO como agua', CH.agua === 0, CH.agua + '% de agua con 0 puesto');

  console.log('\n  -- la caja que se le pide al satélite --');
  T('es cuadrada en el suelo, no en la proyección',
    r.caja && Math.abs(r.caja.anchoGr - r.caja.altoGr) < 1e-5,
    r.caja ? r.caja.anchoGr + ' × ' + r.caja.altoGr + ' grados · ' + r.caja.ladoM + ' m de lado' : 'no hay');
  T('la serie arranca en 1984 y llega a hoy',
    (r.anios || [])[0] === 1984 && (r.anios || []).slice(-1)[0] === (new Date()).getFullYear(),
    (r.anios || []).join(' · '));

  console.log('\n  -- la serie larga, en la ficha --');
  T('el botón está', r.hayBoton === true);
  T('y trae la serie', r.serieEnFicha === true);
  T('pidió un año por paso, a Landsat', (r.pedidas || []).some(x => /^landsat:1984$/.test(x)),
    (r.pedidas || []).filter(x => /landsat/.test(x)).join(' ').slice(0, 90));
  T('con una estampa por año', r.tira >= 8, r.tira + ' estampas');
  /* El año medio tapado se muestra —esconderlo dejaría un salto sin
     explicación— pero marcado, para que se vea que no cuenta. */
  T('el año medio tapado se marca y no se esconde', r.dudosos >= 1,
    r.dudosos + ' marcados de ' + r.tira);
  /* El guion arranca con 20 % de vegetación rala y 50 % de viva —70 % de
     verde— y termina en 14 + 14. La conclusión tiene que traer esos dos
     números, no uno redondeado ni una palabra: es lo que la hace defendible
     delante de un jurado. */
  T('y la conclusión dice que perdió vegetación, con los dos números',
    /perdió vegetación/.test(r.textoFicha || '') &&
    /70% → 28%/.test((r.textoFicha || '').replace(/\s+/g, ' ')),
    ((r.textoFicha || '').match(/perdió vegetación[^]{0,60}/) || ['no lo dice'])[0]);
  T('y que se urbanizó', /Se urbanizó/.test(r.textoFicha || ''));
  T('diciendo que mide con NDVI y por qué no con el clasificador de colores',
    /NDVI/.test(r.textoFicha || '') && /dos cámaras/.test(r.textoFicha || ''));

  console.log('\n  -- la serie de alta resolución no se mezcla --');
  T('trae sus fotos', r.altaEnFicha === true && r.tiraAlta >= 3, r.tiraAlta + ' fotos');
  /* Que se VEAN, no que estén. Las estampas son de 132 px y con el pie
     debajo la tira pasa de 150; aplastada medía diez, con las cinco figuras
     puestas y contadas. La prueba pide el alto de verdad porque contar
     elementos no distingue una tira completa de una rebanada. */
  const G2 = r.geom || {};
  T('y se ven enteras, no aplastadas',
    G2.imagen >= 120 && G2.tira >= 150 && G2.figura >= G2.imagen,
    'tira ' + G2.tira + ' · figura ' + G2.figura + ' · imagen ' +
    G2.anchoImagen + '×' + G2.imagen + ' px');
  /* El año, debajo. La FECHA de la entrega no se pide acá a propósito: en
     esta vuelta el adaptador está sustituido por imágenes de mentira, que no
     tienen entrega ninguna. Que la fecha viaje se comprueba abajo, con el
     adaptador de verdad, que es donde ese dato existe. */
  T('con su año debajo', G2.pie === true);
  /* Lo que importa: NO llevan porcentajes. Ponerles un número al lado
     invitaría a compararlos con los de Landsat, que es otro sensor y otro
     procesamiento. */
  T('y NO les pone porcentajes, a propósito',
    /NO hay porcentajes a propósito/.test(r.textoAlta || '') &&
    !/%\s*verde/.test(r.textoAlta || ''),
    (r.textoAlta || '').slice(0, 80));

  console.log('\n  -- y llega al papel --');
  const EV = cajaDe('Cómo cambió el sitio');
  const PDF = r.pdf || '';
  const secPDF = (PDF.split('<h2>').filter(x => x.indexOf('Cómo cambió el sitio</h2>') === 0)[0] || '');
  T('la lámina trae su caja', !!EV);
  T('con las estampas y los dos extremos',
    (EV.match(/<figure class="evo-p/g) || []).length >= 8 &&
    /verde en 1984/.test(EV) && /verde en 2\d{3}/.test(EV),
    (EV.match(/<figure class="evo-p/g) || []).length + ' estampas');
  T('la conclusión, y de dónde sale el número',
    /perdió vegetación/.test(EV) && /NDVI/.test(EV) && /30 m por píxel/.test(EV));
  /* ── Las fotos, diagramadas en los dos ───────────────────────────────
     Se pidió que el historial saliera «diagramado en el PDF» y no salía: la
     caja del pliego solo sabía dibujar la serie de Landsat —la que mide— y
     el informe en hojas llevaba una tabla de porcentajes sin una sola
     imagen. Una tabla de números no es el historial de un sitio: es su
     resumen. Y la serie que hoy funciona de verdad es justo la que faltaba. */
  T('el pliego trae también la tira de fotos, más grande que las de medir',
    /class="evo-tira evo-alta"/.test(EV) &&
    /\.evo-alta \.evo-p img\{ width:34mm/.test(r.lamina || ''),
    (EV.match(/class="evo-tira[^"]*"/g) || []).join(' · ') || 'no hay tiras');
  T('el informe en hojas trae las dos tiras, con sus imágenes',
    /<div class="evo evo-alta">/.test(secPDF) && /<div class="evo">/.test(secPDF) &&
    (secPDF.match(/<img src="data:image/g) || []).length >= 8,
    (secPDF.match(/<img src="data:image/g) || []).length + ' imágenes en el informe');
  T('y sigue trayendo las cifras y la conclusión',
    /% verde · /.test(secPDF) && /perdió vegetación/.test(secPDF));
  /* Una ficha archivada no guarda las estampas —son megas— así que al
     reimprimirla hay que traer las cifras y NINGUNA imagen rota. */
  T('ninguna estampa sale rota en los dos documentos',
    !/<img src="undefined"/.test(EV + secPDF) && !/<img src="">/.test(EV + secPDF));

  console.log('\n  -- lo que se archiva son las cifras, no las imágenes --');
  const G = r.guardado || {};
  T('la serie queda guardada', G.hay === true && G.pasos >= 8, G.pasos + ' pasos');
  T('con su tendencia', G.tendencia === true);
  /* Quince PNG en base64 son megas y el almacenamiento del teléfono son cinco
     en total: guardarlas se comería la salida entera de un curso. */
  T('y SIN las imágenes, que son megas', G.conImagen === 0 && G.pesoKB < 40,
    G.conImagen + ' con imagen · ' + G.pesoKB + ' KB');

  /* ── Lo que se le pide al servicio de verdad ──────────────────────────
     Esto es lo que no existía y por lo que el historial no funcionaba en un
     teléfono: la prueba sustituía el adaptador entero, así que la dirección
     inventada nunca se miraba. */
  console.log('\n  -- lo que se le pide de verdad al servicio --');
  const RR = r.real || {};
  T('la entrega de 2016 es la que publica Esri, no un año suelto',
    RR.entrega2016 && RR.entrega2016.r === 18966 && /^2016-/.test(RR.entrega2016.fecha),
    RR.entrega2016 ? RR.entrega2016.r + ' · ' + RR.entrega2016.fecha : 'no hay');
  T('y la de 2020 también', RR.entrega2020 && RR.entrega2020.r === 29260,
    RR.entrega2020 ? String(RR.entrega2020.r) : 'no hay');
  /* Antes de 2014 no hay mosaico de alta resolución. Devolver la entrega más
     cercana está bien; rotularla con el año pedido, no. */
  T('un año sin entrega usa la más cercana y lo dice',
    RR.entrega2005 && RR.entrega2005.sustituto === true && RR.entrega2005.anio === 2014,
    RR.entrega2005 ? RR.entrega2005.anio + (RR.entrega2005.sustituto ? ' (sustituta)' : '') : 'no hay');
  const TS = r.teselas || [];
  T('pide teselas WMTS y no un recorte que no existe',
    TS.length > 0 && TS.every(u => /\/World_Imagery\/WMTS\/1\.0\.0\/default028mm\/MapServer\/tile\/\d+\/\d+\/\d+\/\d+/.test(u)),
    TS.length + ' teselas · ' + (TS[0] || 'ninguna').replace(/^https:\/\/[^/]+/, ''));
  T('nunca el endpoint inventado de la primera versión',
    !TS.some(u => /\/export\?/.test(u) || /[?&]anio=/.test(u)),
    TS.filter(u => /export\?|anio=/.test(u)).join(' ') || 'ninguna');
  T('con el número de entrega del año pedido',
    TS.some(u => u.indexOf('/tile/18966/') >= 0) && TS.some(u => u.indexOf('/tile/29260/') >= 0),
    [...new Set(TS.map(u => (u.match(/\/tile\/(\d+)\//) || [])[1]))].join(' · '));
  T('y con eso arma una imagen que se puede leer',
    (RR.pasos || []).length === 2 && (RR.pasos || []).every(p => p.ok && p.pinta),
    (RR.pasos || []).map(p => p.anio + ':' + (p.ok ? 'ok' : p.error)).join(' · '));
  T('cada estampa sabe de qué fecha es, no solo de qué año',
    (RR.pasos || []).every(p => /^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '')),
    (RR.pasos || []).map(p => p.fecha).join(' · '));
  T('y el zoom deja el sector a la escala pedida, no al mundo entero',
    RR.zoom >= 12 && RR.zoom <= 19, 'zoom ' + RR.zoom);

  console.log('');
  T('sin errores de JavaScript', r.err.length === 0, r.err.join(' | ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
