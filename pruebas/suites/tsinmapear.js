const E = require('../entorno.js');
/* UN BARRIO A MEDIO MAPEAR · una capa vacía no es una carencia medida
   ────────────────────────────────────────────────────────────────────────
   El pliego de ajustes del módulo educativo lo llamó «el error más grave de
   la lámina», y tenía razón: hasta la v874 la hoja imprimía

       «parque · necesidad ALTA · sin parques ni plazas con forma registrada»

   sobre un sector donde nadie había dibujado las canchas. La cifra era
   correcta —cero polígonos de espacio público en OpenStreetMap— y la
   conclusión era falsa. Lo mismo con las paradas de bus y con la cobertura
   de equipamientos: cero puntos mapeados daba «100 % del sector sin cubrir»,
   y eso entraba como carencia medida en las cinco propuestas, como debilidad
   en la FODA y como conclusión de banda.

   **Cero mapeados y cero existentes son cosas distintas.** En un barrio
   colombiano corriente los paraderos no están en OpenStreetMap y las canchas
   no tienen polígono; darlo por «no hay» es exactamente el salto que este
   módulo existe para no dar.

   Por qué una suite propia y no una comprobación más en `tdoslaminas`: el
   sector de aquella está BIEN mapeado —tiene parque con forma, tres rutas,
   paradas y equipamientos—, así que estas ramas no se ejercitan ahí y la
   comprobación pasaría por no tener nada que rechazar. Es la lección de la
   v874 escrita como suite: el material de prueba tiene que poder producir el
   defecto. Este sector es el otro caso real, el de la mitad del país.

   Qué tiene el sector, a propósito:
     · comercio y vivienda mapeados de sobra —180 puntos—, así que el análisis
       corre entero y NO es el caso de «sector vacío»;
     · NINGÚN equipamiento: ni colegio, ni salud, ni cultura, ni institucional;
     · NINGÚN parque ni plaza con forma;
     · NINGUNA parada de bus.                                                */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.005;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];
const GLAT = m => m / 110540, GLNG = m => m / (111320 * Math.cos(C.lat * Math.PI / 180));
const P = (dx, dy) => ({ lat: C.lat + GLAT(dy), lng: C.lng + GLNG(dx) });
const LOTE = [P(-60, -45), P(60, -45), P(60, 45), P(-60, 45)];
/* El segundo lote: arriba del todo, entre las calles de y=360 y y=480. Las
   treinta y seis huellas llegan hasta y=255, así que la cuadra que le toca a
   este lote no tiene una sola fachada mapeada — y eso es lo normal en un
   barrio colombiano a medio mapear, no el caso raro. */
const LOTE_SIN_HUELLAS = [P(-40, 400), P(40, 400), P(40, 450), P(-40, 450)];

/* Los usos: SOLO comercio y vivienda. Ni `school`, ni `pharmacy`, ni
   `clinic`, ni `library`, ni `police` — nada que el motor cuente como
   equipamiento. Un corredor de tiendas, que es lo que OpenStreetMap tiene
   mapeado de medio país. */
let gid = 1; const usos = [];
const COMERCIO = ['bakery', 'hairdresser', 'butcher', 'clothes', 'hardware', 'greengrocer'];
for (let i = 0; i < 180; i++) {
  const a = i * 7 * Math.PI / 180, d = (110 + (i % 9) * 40) / 111320;
  usos.push({ type: 'node', id: 2000 + i, lat: C.lat + Math.cos(a) * d, lon: C.lng + Math.sin(a) * d,
    tags: i % 3 === 0
      ? { name: 'Casa ' + i, building: 'house' }
      : { name: 'Local ' + i, shop: COMERCIO[i % COMERCIO.length] } });
}

/* La malla de calles, con vértice compartido en los cruces: sin eso el motor
   cuenta cuatro intersecciones y la morfología sale de supermanzana (v859). */
const geo = []; let nVia = 1;
const NX = 7, NY = 9, PASO = 120;
const nodo = (ix, iy) => P(-360 + ix * PASO, -480 + iy * PASO);
for (let iy = 0; iy < NY; iy++) {
  const pts = []; for (let ix = 0; ix < NX; ix++) pts.push(nodo(ix, iy));
  geo.push({ type: 'way', id: gid++, tags: { highway: 'residential', name: 'Calle ' + (nVia++) },
    geometry: pts.map(p => ({ lat: p.lat, lon: p.lng })),
    center: { lat: pts[3].lat, lon: pts[3].lng } });
}
for (let ix = 0; ix < NX; ix++) {
  const pts = []; for (let iy = 0; iy < NY; iy++) pts.push(nodo(ix, iy));
  geo.push({ type: 'way', id: gid++, tags: { highway: 'residential', name: 'Carrera ' + (nVia++) },
    geometry: pts.map(p => ({ lat: p.lat, lon: p.lng })),
    center: { lat: pts[4].lat, lon: pts[4].lng } });
}
// Unas huellas de edificio, para que el trazado tenga qué medir.
for (let i = 0; i < 36; i++) {
  const ox = (i % 6 - 3) * 110, oy = (Math.floor(i / 6) - 3) * 110;
  const a = P(ox, oy), b = P(ox + 45, oy), c = P(ox + 45, oy + 35), d = P(ox, oy + 35);
  geo.push({ type: 'way', id: gid++, tags: { building: 'yes', 'building:levels': String(1 + (i % 3)) },
    geometry: [a, b, c, d, a].map(p => ({ lat: p.lat, lon: p.lng })) });
}
const cotaDe = ln => 300 + Math.round(30 * Math.sin(ln * 800));

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
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
    body: JSON.stringify({ address: { city: 'Cúcuta', state: 'Norte de Santander', country: 'Colombia', suburb: 'Atalaya' } }) }));
  await ctx.route(/overpass/, r => {
    const q = (r.request().postData() || '') + r.request().url();
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos.concat(geo) }) });
  });
  await E.rutaDane(ctx);
  await ctx.route(/elevation/, r => { const u = new URL(r.request().url());
    const lngs = (u.searchParams.get('locations') || '').split('|');
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elevation: lngs.map(cotaDe) }) }); });

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);
  const r = await pg.evaluate(async (D) => {
    const { C, POL, LOTE, LOTE_SIN_HUELLAS } = D, o = {}, esperar = ms => new Promise(x => setTimeout(x, ms));
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
    const x = H().querySelector('[data-pcr="trazado"]');
    if (x) { x.click(); for (let i = 0; i < 70 && !document.querySelector('.pcr-llenos'); i++) await esperar(400); }
    await esperar(300);

    /* Lo que este sector tiene y no tiene, leído del propio análisis: si el
       fixture dejara de ser pobre, estas cifras lo dirían y las
       comprobaciones de abajo dejarían de medir lo que dicen medir. */
    o.pu = R.propuestasDeUso ? R.propuestasDeUso() : null;
    o.sin = R.sintesisDelSector ? R.sintesisDelSector() : null;
    o.accesibilidad = (R.estado ? R.estado() : {}).accesibilidad || {};

    const bl = H().querySelector('[data-pcr="lamina-doble"]') || H().querySelector('[data-pcr="lamina-ver"]');
    if (bl) { bl.click(); await esperar(1400); }
    o.doc = capturado; capturado = '';

    /* §1 (v899) · UNA CUADRA SIN UNA SOLA HUELLA MAPEADA.
       ────────────────────────────────────────────────────────────────────
       El pliego v2 lo trajo impreso de la corrida real: «CONTINUIDAD DEL
       PARAMENTO — 0 % del frente de la cuadra con fachada — frente roto: el
       proyecto puede cerrar la cuadra». Ese cero es la fracción del tramo de
       calle cubierta por huellas de OpenStreetMap, y con cero huellas da
       cero siempre: no mide un frente, mide una capa vacía.

       El lote de arriba está en el centro, donde SÍ hay huellas, así que esa
       rama se mide y la otra no se ejercitaba en ninguna prueba —es el
       agujero que este proyecto lleva catorce tandas persiguiendo—. Se
       dibuja un SEGUNDO lote arriba del todo, en la franja donde la malla de
       calles llega y las treinta y seis huellas no: la cuadra que le toca no
       tiene una sola fachada mapeada, que es el caso del reporte.

       Las dos ramas se miden en la misma corrida: con huellas, la casilla
       trae su porcentaje; sin ellas, dice SIN MEDIR y nombra qué la llena. */
    const b2 = H().querySelector('[data-pcr="lote-borrar"]');
    if (b2) { b2.click(); await esperar(300); }
    const bd2 = H().querySelector('[data-pcr="lote-dibujar"]');
    if (bd2) { bd2.click(); await esperar(400); }
    for (const p of LOTE_SIN_HUELLAS) { window.map.fire('click', { latlng: { lat: p.lat, lng: p.lng } }); await esperar(50); }
    const bc2 = document.querySelector('#pcr-lote-barra [data-lote="cerrar"]');
    if (bc2) { bc2.click(); await esperar(900); }
    R.abrir(); await esperar(400);
    const bl2 = H().querySelector('[data-pcr="lamina-doble"]') || H().querySelector('[data-pcr="lamina-ver"]');
    if (bl2) { bl2.click(); await esperar(1400); }
    o.docSinHuellas = capturado;
    return o;
  }, { C, POL, LOTE, LOTE_SIN_HUELLAS });
  await pg.close(); await ctx.close(); await b.close();

  try { fs.writeFileSync(E.TRABAJO + 'lamina-sinmapear.html', r.doc || '', 'utf8'); } catch (e) {}

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };
  const doc = String(r.doc || '');
  const txt = doc.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');

  console.log('\n  -- el sector es pobre de mapa, y eso hay que poder verlo --');
  T('el análisis corrió y produjo propuestas', !!(r.pu && r.pu.propuestas && r.pu.propuestas.length),
    (r.pu && r.pu.propuestas ? r.pu.propuestas.length : 0) + ' propuestas');
  if (!r.pu) { console.log('\n  ' + (mal || 1) + ' comprobaciones fallaron'); process.exit(1); }
  /* Sin esto, todo lo de abajo pasaría por no tener nada que rechazar. */
  /* El sector ejercita LAS DOS ramas, y eso importa más que tenerlo todo
     vacío: tres clases sin un solo punto —las que tienen que salir como
     tarea— y una, el comercio, con sesenta —la que sí sostiene una cobertura
     medida—. Un fixture con todo en cero probaría que la hoja calla, no que
     sabe distinguir. */
  const cats = (r.accesibilidad.categorias || []);
  const vacias = cats.filter(c => !Number(c.puntos)), conPuntos = cats.filter(c => Number(c.puntos) > 0);
  T('hay clases de equipamiento sin un solo punto mapeado', vacias.length >= 3,
    cats.map(c => c.etiqueta + ':' + c.puntos).join(' · ') || 'sin categorías');
  T('y al menos una con puntos, para que la rama medida también corra',
    conPuntos.length >= 1, conPuntos.map(c => c.etiqueta + ':' + c.puntos).join(' · ') || 'ninguna');

  console.log('\n  -- §5 · una capa vacía no sostiene una propuesta --');
  const pr = r.pu.propuestas || [];
  const necTextos = pr.map(p => String(p.necTexto || '')).join(' | ');
  /* La guarda de la v875 se APRETÓ en la v889, no se aflojó. Decía «ningún
     necTexto nombra lo registrado o lo mapeado» y eso, palabra a palabra,
     prohibía también la frase honesta —«sin medir: la capa de colegio o
     jardín no tiene un solo punto mapeado»—, que es justo lo que §20 vino a
     poner. Lo que la v875 quería impedir es que una NECESIDAD se apoye en
     una ausencia de mapeo; una propuesta que declara que no se pudo medir no
     afirma ninguna necesidad.

     Así que se parte en dos, y la segunda mitad es nueva: las que traen una
     necesidad medida no pueden nombrar el mapa, y las que no se pudieron
     medir tienen que llevar la etiqueta «sin medir» y no «baja». Sin esa
     segunda mitad, bastaría con dejar de decir la palabra para pasar. */
  const conNecesidad = pr.filter(p => String(p.necesidad || '') !== 'sin medir');
  T('ninguna propuesta con necesidad medida se apoya en «registrado» o «mapeado»',
    !/registrad|mapead/i.test(conNecesidad.map(p => String(p.necTexto || '')).join(' | ')),
    conNecesidad.map(p => p.necTexto).join(' | ').slice(0, 150) || 'ninguna');
  const sinMedir = pr.filter(p => /^sin medir/.test(String(p.necTexto || '')));
  T('y las que no se pudieron medir lo dicen: «sin medir», nunca «necesidad baja»',
    sinMedir.length >= 1 && sinMedir.every(p => String(p.necesidad) === 'sin medir'),
    sinMedir.map(p => p.necesidad + ' · ' + String(p.necTexto).slice(0, 46)).join(' | ') || 'ninguna sin medir');
  T('ninguna propuesta sale de una cobertura sin un solo punto mapeado',
    !pr.some(p => /% del sector a más de/.test(String(p.necTexto || ''))),
    (necTextos.match(/[^|]*% del sector a más de[^|]*/) || ['ninguna'])[0].slice(0, 110));
  T('y lo que no se pudo medir sale como algo que ir a comprobar',
    (r.pu.verificar || []).length >= 3,
    (r.pu.verificar || []).map(v => v.que).join(' · ').slice(0, 160));
  /* Cada tarea dice las tres cosas, que es lo que la separa de una queja. */
  T('cada una dice qué comprobar, por qué no se pudo y cómo se resuelve',
    (r.pu.verificar || []).every(v => v.que && v.porque && v.como),
    (r.pu.verificar || []).length + ' completas');

  console.log('\n  -- §5 · ni una conclusión de banda, ni la FODA --');
  const dc = (r.sin && r.sin.contra) || [];
  const dcT = dc.map(x => String(x.texto || '')).join(' · ');
  T('«sin parques registrados» no entra como debilidad del sector',
    !dc.some(x => /parque|plaza|espacio público/i.test(String(x.texto || ''))),
    dcT.slice(0, 140) || 'ninguna debilidad');
  T('ni «falta equipamiento a distancia de caminar» sobre una capa vacía',
    !dc.some(x => /a distancia de caminar/i.test(String(x.texto || ''))),
    dcT.slice(0, 140) || 'ninguna debilidad');
  /* Ni las otras dos del mismo molde, que salieron al correr esta suite por
     primera vez y no estaban en el pliego de ajustes: las paradas como
     amenaza externa, y la densidad de usos REGISTRADOS como debilidad —por
     debajo de tres por hectárea, un sector vacío y uno sin mapear se ven
     exactamente igual. */
  T('ni las paradas de bus como amenaza externa',
    !dc.some(x => /parada/i.test(String(x.texto || ''))), dcT.slice(0, 140) || 'ninguna');
  T('ni la densidad de lo registrado como debilidad del sitio',
    !dc.some(x => /poca actividad registrada/i.test(String(x.texto || ''))), dcT.slice(0, 140) || 'ninguna');
  /* Pero tampoco se calla: pasa a la lista de lo que hay que conseguir. */
  const tr = (r.sin && r.sin.falta) || [];
  T('y en su lugar quedan como tareas, con el porqué',
    tr.some(x => /parques|canchas|plazas/i.test(String(x.texto || ''))) &&
    tr.some(x => /no aparece ninguno mapeado/i.test(String(x.texto || ''))),
    tr.map(x => x.texto).join(' · ').slice(0, 170));

  console.log('\n  -- lo impreso lo dice con esas palabras --');
  T('la hoja trae el panel de lo que hay que comprobar',
    /Antes de proponer, compruebe esto/.test(txt), 'panel presente');
  T('y explica que una capa vacía no es un sector sin eso',
    /capa vacía en OpenStreetMap no es un sector sin eso/.test(txt));
  /* La frase vieja era «N paradas de transporte público registradas» con N
     en cero, que se lee como una medición. La nueva nombra el mapa. */
  /* El cierre de la lámina B: los once cruces. El primero cerraba en
     decisión —«ahí va el primer equipamiento»— repartiendo la población
     entre clases que podían no tener un solo punto mapeado. */
  T('el cruce de cobertura no reparte habitantes sobre una capa vacía',
    !/Colegio o jardín: 0 hab\. servidos/.test(txt) && !/Servicio de salud: 0 hab\. servidos/.test(txt),
    (txt.match(/Cobertura de equipamientos[^.]{0,120}/) || ['no sale'])[0]);
  T('y nombra las clases que se quedaron fuera de la cuenta',
    /sin un punto mapeado/.test(txt),
    (txt.match(/sin un punto mapeado[^.]{0,80}/) || ['no las nombra'])[0]);
  T('la conclusión de movilidad nombra el mapa y no el sector',
    /ninguna parada mapeada, que no es lo mismo que ninguna parada/.test(txt) &&
    !/\b0 paradas de transporte público registradas/.test(txt),
    (txt.match(/ninguna parada[^.]{0,70}/) || ['no lo dice'])[0]);

  /* §1 (v899) · LAS DOS RAMAS DEL PARAMENTO, en la misma corrida.
     Con huellas sobre la cuadra la casilla trae su porcentaje; sin una sola
     huella dice SIN MEDIR y nombra qué la llena. Medir solo la segunda
     dejaría pasar un «SIN MEDIR» puesto en todas partes, que sería la
     mentira contraria y la que la v875 ya rechazó una vez. */
  console.log('\n  -- §1 · la casilla que no se pudo medir no lleva cifra --');
  const paramDe = (h) => {
    const m = /<i class="cv-k">Continuidad del paramento<\/i><b class="cv-v">([^<]*)<\/b><small class="cv-l">([^<]*)<\/small>/
      .exec(String(h || ''));
    return m ? { v: m[1], l: m[2] } : null;
  };
  const pCon = paramDe(doc), pSin = paramDe(String(r.docSinHuellas || ''));
  T('con huellas sobre la cuadra, el paramento trae su porcentaje',
    !!pCon && /% del frente de la cuadra/.test(pCon.v), pCon ? pCon.v : 'no sale el cruce');
  T('sin una sola huella, no imprime un 0 % sino SIN MEDIR',
    !!pSin && /SIN MEDIR/.test(pSin.v) && !/^0 %/.test(pSin.v),
    pSin ? pSin.v : 'no sale el cruce');
  T('y dice que el cero es del mapa, no del frente, y qué lo llena',
    !!pSin && /del mapa y no del frente/.test(pSin.l) && /Actividad en primer piso/.test(pSin.l),
    pSin ? pSin.l.slice(0, 130) : '—');
  /* Y lo que de verdad importa: que esa casilla ya no cierre en una
     recomendación de proyecto sobre una capa vacía. */
  T('y no concluye «frente roto» sobre una cuadra que nadie mapeó',
    !!pSin && !/frente roto|cerrar la cuadra/.test(pSin.v + ' ' + pSin.l),
    pSin ? (pSin.v + ' · ' + pSin.l).slice(0, 110) : '—');

  T('y la página no soltó errores', err.length === 0, err.slice(0, 2).join(' · ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' comprobaciones fallaron' : 'todo en verde'));
  process.exit(mal ? 1 : 0);
})();
