const E = require('../entorno.js');
/* EL TOTAL DE USOS, CONTRA LA CORRIDA ANTERIOR DEL MISMO SECTOR (v915)
   ────────────────────────────────────────────────────────────────────────
   Reportado con dos PDF del mismo sector y el mismo radio en la mano: 1.380
   usos en uno y 1.320 en el otro, sin una palabra que lo explicara. Medido
   sobre el diff, la versión intermedia no toca una sola línea de conteo, así
   que la diferencia no viene del código: viene de la FUENTE.

   Pero eso el lector no tiene cómo saberlo, y dos cifras distintas bajo el
   mismo rótulo se leen como un error de la herramienta — que es lo que la
   v879 persigue entre las dos láminas, acá entre dos corridas.

   POR QUÉ UNA SUITE PROPIA, y es la razón de fondo: hace falta CORRER EL
   MISMO SECTOR DOS VECES con totales distintos, y eso no lo tiene ninguna
   suite de la batería. `tdoslaminas` vuelve a analizar, sí, pero con otro
   radio —que es otro sector para esta comparación, y con razón—. Sin las dos
   corridas la comprobación pasaría por no tener nada que rechazar, que es el
   agujero que este proyecto lleva dieciocho tandas persiguiendo.

   Y las TRES ramas, porque el umbral es la mitad del asunto:

     · corrida 1 → no hay con qué comparar y la hoja NO inventa un aviso;
     · corrida 2 → 24 usos menos sobre 79 ha: pasa el umbral y se dice;
     · corrida 3 → 1 uso menos: no lo pasa y la hoja se calla.

   La tercera es la que de verdad guarda. Sin ella, el arreglo podría haber
   sido avisar de toda diferencia, y entonces el aviso saldría en cada corrida
   por un uso de más — que es como muere una alarma (v886).                */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';

/* Un sector de 500 m de lado: 25 ha… no. El cuadrado va de ±0,0045° de lado
   medio, que a esta latitud son unos 1.000 × 1.000 m — 100 ha, y el umbral
   que sale de ahí son 5 usos. Con eso 24 lo pasa de sobra y 1 no, que son
   las dos ramas sin que ninguna quede al filo. */
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.0045;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];

/* Los usos: un manojo repartido, con nombre y categoría, para que el motor
   los clasifique y la tabla «Qué hay, por categoría» tenga qué imprimir. */
const AMEN = ['pharmacy', 'restaurant', 'school', 'bank', 'cafe'];
function usosDe(n) {
  const out = []; let id = 1;
  for (let i = 0; i < n; i++) {
    const a = (i * 137.5) * Math.PI / 180, d = (80 + (i % 7) * 55) / 111320;
    out.push({ type: 'node', id: id++, lat: C.lat + Math.cos(a) * d, lon: C.lng + Math.sin(a) * d,
               tags: { name: 'Uso ' + i, amenity: AMEN[i % AMEN.length] } });
  }
  return out;
}

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota',
    locale: 'es-CO', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'urbisprocity',
        rol: 'admin', es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('aia_overpass_cache_v1');
      localStorage.removeItem('pcr_fichas_v1');
      /* Y el almacén de conteos, que es justo lo que esta suite mide: sin
         limpiarlo, una corrida anterior de otra sesión decidiría el
         resultado. */
      localStorage.removeItem('pcr_conteos_v1');
    } catch (e) {}
  });
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200,
    contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: fs.readFileSync(S + 'node_modules/chart.js/dist/chart.umd.js', 'utf8') }));
  await ctx.route(/locationiq\.com/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ address: { city: 'Cúcuta', state: 'Norte de Santander',
      country: 'Colombia', suburb: 'La Playa' } }) }));
  await E.rutaDane(ctx);

  /* El doble de Overpass contesta MENOS usos en cada corrida, que es
     exactamente lo que pasa de verdad: OpenStreetMap se mapea de a poco y
     Overpass no devuelve siempre lo mismo. Los saltos están elegidos para
     que el primero pase el umbral y el segundo no. */
  const TOTALES = [140, 116, 115];
  let corrida = 0;
  await ctx.route(/overpass/, r => {
    const n = TOTALES[Math.min(corrida, TOTALES.length - 1)];
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ elements: usosDe(n) }) });
  });

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  /* Cada corrida dibuja EL MISMO polígono y analiza. Redibujarlo da los
     mismos vértices, así que el centroide y el área son los mismos y la
     llave del sector también — que es lo que hace que la comparación tenga
     de qué hablar. */
  const analizar = async () => {
    return pg.evaluate(async (D) => {
      const { C, POL } = D, esperar = ms => new Promise(x => setTimeout(x, ms));
      /* El caché de Overpass dura 24 h a propósito (v851), así que sin
         limpiarlo las tres corridas leen la MISMA respuesta guardada y el
         total no se mueve — medido: 116 · 116 · 116, y la comprobación
         habría pasado por no tener nada que rechazar. Limpiarlo es lo que le
         pasa de verdad a quien vuelve al día siguiente o desde otro
         teléfono, que es exactamente el caso que el reporte describe. */
      try { localStorage.removeItem('aia_overpass_cache_v1'); } catch (e) {}
      window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
      window.map.setView([C.lat, C.lng], 15); await esperar(300);
      const A = window.URBIS_PC_ANALISIS, R = window.URBIS_PC_RECON;
      const bPC = document.querySelector('[data-u52-call="procity-open-map"]');
      if (bPC) { bPC.click(); await esperar(400); }
      A.iniciarDibujo();
      POL.forEach(p => A.agregarPunto(p.lat, p.lng));
      A.agregarPunto(POL[0].lat, POL[0].lng);
      R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
      await R.analizar(); await esperar(900);
      const st = R.estado() || {};
      return {
        total: st.total || 0,
        previo: st.conteoPrevio || null,
        /* La lámina B, que es donde vive la tabla de categorías: es el papel
           en el que el aviso tiene que salir, y medirlo en la variable sería
           medir otra cosa (v879). */
        hoja: R.laminaA({ hoja: 'B' }) || ''
      };
    }, { C, POL });
  };

  const esperarLimitador = () => pg.evaluate(() => new Promise(x => setTimeout(x, 5200)));

  const R1 = await analizar(); corrida++;
  await esperarLimitador();
  const R2 = await analizar(); corrida++;
  await esperarLimitador();
  const R3 = await analizar();

  await b.close();
  try { fs.writeFileSync(E.TRABAJO + 'lamina-conteo.html', R2.hoja || '', 'utf8'); } catch (e) {}

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };
  const plano = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  /* El aviso se lee DENTRO de su caja y no en la hoja entera: es la lección
     de la v854 y de la v879 —pescar la primera cifra del documento agarra la
     medición en un sitio y el estándar en otro—. */
  const avisoEn = (h) => {
    const d = plano(h);
    const m = d.match(/[\d.,]+ usos · la corrida anterior[^.]*\.[^.]*\.[^.]*\./);
    return m ? m[0] : '';
  };

  console.log('\n  -- la primera corrida no tiene con qué comparar --');
  T('se analiza y cuenta sus usos', R1.total > 0, R1.total + ' usos');
  /* La guarda, y vale más que la afirmación: una hoja que inventara la
     comparación en la primera corrida saldría con un aviso sobre una cifra
     que nadie midió. */
  T('y la hoja NO imprime ninguna comparación con una corrida que no existe',
    !R1.previo && !avisoEn(R1.hoja), R1.previo ? JSON.stringify(R1.previo) : 'ninguna');

  console.log('\n  -- la segunda, con 24 usos menos, lo dice --');
  T('el total bajó de verdad entre las dos corridas',
    R2.total > 0 && R2.total !== R1.total, R1.total + ' → ' + R2.total);
  T('la diferencia pasa el umbral y queda anotada con el total anterior',
    !!(R2.previo && R2.previo.total === R1.total),
    R2.previo ? R2.previo.total + ' (umbral ' + R2.previo.umbral + ')' : 'ninguna');
  const A2 = avisoEn(R2.hoja);
  T('y sale impreso en el papel, con las DOS cifras',
    A2.indexOf(String(R2.total)) !== -1 && A2.indexOf(String(R1.total)) !== -1,
    A2 || 'no sale');
  /* Lo que de verdad hace el aviso: sin la procedencia, dos cifras distintas
     bajo el mismo rótulo se leen como un error de esta hoja — que es
     exactamente lo contrario de lo que son. */
  T('diciendo de dónde viene la diferencia, y que no es un error de la hoja',
    /OpenStreetMap cambia entre consultas/.test(A2) && /No es un error de esta hoja/.test(A2),
    A2.slice(-120) || 'no lo dice');
  T('y con la fecha de la corrida anterior, para saber si fue hoy o el mes pasado',
    /la corrida anterior \(\d+\/\d+\)/.test(A2),
    (A2.match(/la corrida anterior[^·]{0,14}/) || ['—'])[0]);

  console.log('\n  -- la tercera, con UN uso menos, se calla --');
  T('el total volvió a moverse, apenas', R3.total !== R2.total, R2.total + ' → ' + R3.total);
  /* La guarda del umbral. Sin ella el arreglo podría haber sido avisar de
     toda diferencia, y el aviso saldría en cada corrida por un uso de más:
     es como muere una alarma (v886 con el piso y el objetivo). */
  T('por debajo del umbral la hoja NO lo imprime: no mueve ninguna cifra impresa',
    !R3.previo && !avisoEn(R3.hoja),
    R3.previo ? 'lo anota igual: ' + JSON.stringify(R3.previo) : 'callada, que es lo correcto');

  T('y ninguna de las tres corridas soltó errores', err.length === 0, err.slice(0, 2).join(' · ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' comprobaciones fallaron' : 'todo en verde'));
  process.exit(mal ? 1 : 0);
})();
