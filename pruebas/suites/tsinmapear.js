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
  /* v953 · la capa del censo de ESTE sector no expone servicios, que es la
     rama contraria a la de `tlaminaedu`. Sin ella, «con barras no es un
     vacío» pasaría igual el día que alguien quitara el ternario y la caja
     saliera siempre como una caja normal —con su pie de método afirmando una
     fórmula sobre una cifra que no tiene—. Es la mentira contraria, y esta es
     la mitad que la guarda. */
  const SIN_SERVICIOS = E.CAMPOS_DANE.filter(function (c) {
    return !/ACUEDUCTO|ALCANTARILLADO|ENERGIA|GAS/.test(c.name); });
  await E.rutaDane(ctx, { camposDane: SIN_SERVICIOS });
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

    /* §10 (v906) · el conteo de edificios TAL COMO LA FICHA lo imprime, para
       poder cruzarlo con el de la lámina. Este sector es el único de la
       batería que puede producir el defecto: trae sesenta casas como PUNTO
       —que la consulta de usos ve y la del trazado no pide— y treinta y seis
       huellas con sus pisos, así que hasta la v905 la ficha se quedaba con la
       lista MAYOR y la lámina con la que trajera pisos, y las dos imprimían
       una cifra distinta bajo el mismo nombre. En el sector de
       `tdoslaminas` las dos reglas coinciden y esto habría pasado en verde
       por no tener nada que rechazar. */
    o.fichaTexto = (H().textContent || '').replace(/\s+/g, ' ').trim();

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
    o.docSinHuellas = capturado; capturado = '';

    /* ══ v934 · LA TERCERA RAMA: LA MISMA CUADRA, YA CAMINADA ═══════════
       Las dos de arriba son «con huellas» y «sin huellas». Falta la que la
       propia hoja promete: con la plantilla de campo llena, «esta casilla se
       calcula sola». Hasta la v933 nada podía cumplirlo.

       Va acá y no en `tpostsector` porque el material vive acá: aquella
       suite no mide el trazado, así que `laCuadraDelLote` devuelve null y la
       comprobación pasaría por no tener nada que rechazar — el agujero que
       este proyecto lleva veintidós tandas persiguiendo. Acá el segundo lote
       está sobre una cuadra con calles y sin una sola huella, que es
       exactamente el sector de quien tiene que salir a medirla.

       Se guarda por la PUERTA de verdad y no escribiéndole al almacén: es la
       regla de la v871, y de paso ejercita el manejador —que es justo lo que
       la v932 pagó en tres vueltas por no hacer—. */
    o.paramAntes = ((R.estado() || {}).paramento) || null;
    const pg = H().querySelector('[data-pcr="pestana"][data-p="general"]');
    if (pg) { pg.click(); await esperar(400); }
    o.puertaAct = !!document.querySelector('[data-pcr-act="cuadra"][data-i="0"]');

    const ponAct = (k, i, val) => {
      const sel = '[data-pcr-act="' + k + '"]' + (i === null ? '' : '[data-i="' + i + '"]');
      const el = document.querySelector(sel);
      if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }
      return !!el;
    };
    const guardarAct = async () => {
      const b = H().querySelector('[data-pcr="act-guardar"]');
      if (b) { b.click(); await esperar(500); }
      return !!b;
    };

    /* (a) Una fila a la que le falta la medida NO se guarda a medias. */
    ponAct('cuadra', 0, 'Calle de arriba, lado sur');
    ponAct('quien', null, 'Ana Ruiz');
    ponAct('fechaDoc', null, '2026-09-14');
    await guardarAct();
    o.rechazoSinMedida = ((R.estado() || {}).actividad || {}).estado;
    o.avisoSinMedida = ((R.estado() || {}).aviso) || '';

    /* (b) Y el activo no puede pasarse del total: un porcentaje por encima
           de 100 saldría impreso, que es el defecto de la v859. */
    ponAct('cuadra', 0, 'Calle de arriba, lado sur');
    ponAct('total', 0, '80'); ponAct('activo', 0, '120');
    ponAct('quien', null, 'Ana Ruiz'); ponAct('fechaDoc', null, '2026-09-14');
    await guardarAct();
    o.rechazoActivoMayor = ((R.estado() || {}).actividad || {}).estado;
    o.avisoActivoMayor = ((R.estado() || {}).aviso) || '';

    /* (c) Y un rango al revés tampoco: «entre el 9 y el 2» no se lee. */
    ponAct('cuadra', 0, 'Calle de arriba, lado sur');
    ponAct('total', 0, '80'); ponAct('activo', 0, '34');
    ponAct('quien', null, 'Ana Ruiz');
    ponAct('fechaDoc', null, '2026-09-14'); ponAct('fechaHasta', null, '2026-09-02');
    await guardarAct();
    o.rechazoRangoAlReves = ((R.estado() || {}).actividad || {}).estado;
    o.avisoRango = ((R.estado() || {}).aviso) || '';

    /* (c-bis) DOS cuadras y ninguna marcada. Es la que de verdad protege:
           promediarlas publicaría una cifra de SECTOR en una casilla rotulada
           «predio», que es el error de escala de la v854. No se guarda, y el
           aviso dice por qué en vez de elegir por el lector. */
    ponAct('cuadra', 0, 'Calle de arriba, lado sur');
    ponAct('total', 0, '80'); ponAct('activo', 0, '34');
    ponAct('cuadra', 1, 'Calle de arriba, lado norte');
    ponAct('total', 1, '80'); ponAct('activo', 1, '72');
    ponAct('quien', null, 'Ana Ruiz');
    ponAct('fechaDoc', null, '2026-09-12'); ponAct('fechaHasta', null, '');
    await guardarAct();
    o.rechazoSinMarcar = ((R.estado() || {}).actividad || {}).estado;
    o.avisoSinMarcar = ((R.estado() || {}).aviso) || '';

    /* (d) Ahora bien: una cuadra, sus dos medidas, quién y un rango de dos
           días —que es lo que pasa cuando ocho cuadras no caben en una
           tarde—. El precedente del rango es de los edificios de campo.

           La segunda cuadra hay que BORRARLA a mano, y no es un rodeo de la
           prueba: desde la v954 un rechazo ya no se lleva lo tecleado, así
           que la fila que (c-bis) escribió sigue ahí. Es exactamente lo que
           hace una persona que decide quedarse con una sola —la otra opción,
           igual de real, es marcar cuál es la del lote, y esa la ejercita el
           paso (e)—. Hasta la v953 este paso se apoyaba en que el formulario
           volviera vacío, que era el defecto. */
    ponAct('cuadra', 1, ''); ponAct('total', 1, ''); ponAct('activo', 1, '');
    ponAct('cuadra', 0, 'Calle de arriba, lado sur');
    ponAct('total', 0, '80'); ponAct('activo', 0, '34');
    ponAct('quien', null, 'Ana Ruiz');
    ponAct('fechaDoc', null, '2026-09-12'); ponAct('fechaHasta', null, '2026-09-14');
    o.guardoAct = await guardarAct();
    o.actGuardada = ((R.estado() || {}).actividad || {});
    o.paramDespues = ((R.estado() || {}).paramento) || null;
    o.campoGuardado = (R.leerCampo(((R.estado() || {}).llaveCampo) || '') || [])
      .filter(x => x.hueco === 'actividad-en-primer-piso')
      .map(x => ({ filas: ((x.valor || {}).filas || []).length,
                   quien: x.fuente.quien, desde: x.fuente.fechaDoc, hasta: x.fuente.fechaHasta }));

    /* Y la hoja se vuelve a componer: lo que importa es lo que el lector
       encuentra en el papel, no lo que la variable dice (v879). */
    const bl3 = H().querySelector('[data-pcr="lamina-doble"]') || H().querySelector('[data-pcr="lamina-ver"]');
    if (bl3) { bl3.click(); await esperar(1400); }
    o.docCaminada = capturado; capturado = '';

    /* (e) LA PLANTILLA REPARTIDA (v949). Va DESPUÉS de componer la hoja a
           propósito: el almacén deduplica por hueco, así que guardar otra vez
           reemplaza lo de (d) y cambiaría el papel que las aserciones de
           arriba ya midieron.

           Y acá la atribución NO es la lista, a diferencia de las otras tres
           plantillas caminadas: esta casilla publica la cifra de UNA fila —la
           cuadra del lote, porque está rotulada a escala de predio (v854)—,
           así que ponerle los dos nombres le atribuiría a Luis una medición
           que hizo Ana. Es la falta de la v867 con la ropa de una mejora, y
           es lo que esta aserción guarda. */
    /* Se vuelve a buscar el botón de la pestaña: `pintar()` rehace el panel,
       así que el nodo de arriba quedó desprendido y hacerle clic no hace
       nada — lo cazó la guarda de MATERIAL, que es para lo que está. Y la
       puerta está en estado «ok» desde (d), sin formulario: para anotar dos
       cuadras hay que quitar lo anotado primero, que es lo que la aplicación
       permite hoy (el formulario que no deja agregar una fila es el defecto
       ya declarado en la v940, y es de las cinco puertas). */
    const pg2 = H().querySelector('[data-pcr="pestana"][data-p="general"]');
    if (pg2) { pg2.click(); await esperar(400); }
    const bq = H().querySelector('[data-pcr="act-borrar"]');
    if (bq) { bq.click(); await esperar(500); }
    o.hayFormulario = !!document.querySelector('[data-pcr-act="cuadra"][data-i="1"]');
    /* TRES cuadras y TRES nombres distintos, y ninguno es casual:

         · la marcada la midió Marta, que NO es quien responde por la
           plantilla. Sin esa diferencia la aserción pasaría por el motivo
           equivocado —el `quien` de la entrada coincidiría con el de la fila—
           y no distinguiría esta versión de la anterior. Se vio demostrando,
           no leyendo;
         · la segunda la midió Luis, que es lo que hace que la lista tenga más
           de un nombre;
       La rama del respaldo —una fila en blanco, que cae en quien responde por
       la plantilla— NO se mide acá y no por olvido: la puerta ofrece dos
       renglones de sobra y un rechazo no guarda nada, así que desde una
       plantilla recién vaciada no se llega a tres filas. Esa rama vive en
       `tmasanalisis`, donde el primer tramo del perfil va en blanco. */
    ponAct('cuadra', 0, 'Calle de arriba, lado sur');
    ponAct('total', 0, '80'); ponAct('activo', 0, '34');
    ponAct('quienFila', 0, 'Marta Peña');
    ponAct('cuadra', 1, 'Calle de arriba, lado norte');
    ponAct('total', 1, '90'); ponAct('activo', 1, '81');
    ponAct('quienFila', 1, 'Luis Ortega');
    const rad0 = document.querySelector('[data-pcr-act="lote"][data-i="0"]');
    if (rad0) { rad0.checked = true; rad0.dispatchEvent(new Event('change', { bubbles: true })); }
    ponAct('quien', null, 'Ana Ruiz');
    ponAct('fechaDoc', null, '2026-09-12'); ponAct('fechaHasta', null, '2026-09-14');
    o.guardoRepartida = await guardarAct();
    o.paramRepartido = ((R.estado() || {}).paramento) || null;
    o.actRepartida = ((R.estado() || {}).actividad || {});
    /* Se lee el textContent de la hoja —no `innerText`, que se queda vacío
       sobre lo que el navegador no considera renderizado— y se ancla por
       CONTENIDO, no por distancia desde el título (v935). */
    o.puertaRepartida = ((H().textContent || '').replace(/\s+/g, ' ')
      .match(/Actividad en primer piso.*?% del frente con puerta.{0,420}/) || [''])[0];

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
  /* ── SERVICIOS PÚBLICOS SIN CAPA QUE CONTESTE (v953) ────────────────────
     La rama contraria a la de `tlaminaedu`. Se corta la caja del papel: desde
     la `<section>` que la abre hasta la siguiente, porque la CLASE va antes
     del `<h2>` y anclando en el título se pierde justo lo que se quiere
     medir. */
  const cajaServicios = (h) => {
    const t = String(h || '');
    const i = t.indexOf('>Servicios públicos<');
    if (i < 0) return null;
    const ini = t.lastIndexOf('<section', i);
    if (ini < 0) return null;
    const fin = t.indexOf('<section', ini + 8);
    return t.slice(ini, fin < 0 ? t.length : fin);
  };
  const CS = cajaServicios(doc);
  /* MATERIAL primero (v920): esta corrida tiene que traer la caja y su capa
     tiene que NO exponer servicios. Si alguna de las dos deja de ser cierta,
     se pone roja ella y lo de abajo no significa nada. */
  T('MATERIAL · la caja de servicios está en la hoja y su capa no los expone',
    !!CS && /ninguno corresponde a acueducto|no se pudo preguntar/i.test(CS),
    CS ? CS.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 130) : 'no está la caja');
  if (CS) {
    /* El detalle enseña lo que de verdad encontró: uno que imprime el texto
       del fallo aun cuando pasa miente justo cuando hace falta leerlo. */
    T('sin capa que conteste, la caja SÍ se presenta como un vacío',
      /class="[^"]*caja-vacio/.test(CS),
      /class="[^"]*caja-vacio/.test(CS) ? 'ámbar a trazos, como corresponde'
                                        : 'SIN la clase caja-vacio');
    /* Y sin pie de método, que es lo correcto acá: `caja()` lo suprime en las
       `caja-vacio` desde la v880 justamente para no declarar una fórmula
       sobre una cifra que no se tiene. */
    T('y entonces no declara un método sobre una cifra que no tiene',
      !/class="metodo/.test(CS),
      /class="metodo/.test(CS) ? 'TRAE pie de método sin dato' : 'sin pie de método');
    T('y declara la ausencia con la lista de campos como prueba (v865)',
      /declara \d+/.test(CS) || /no se pudo preguntar/i.test(CS),
      CS.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 160));
  }

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

  /* §2 (v910) · Y EL CHEQUEO QUE LEE ESA CASILLA NO PUEDE DARLA POR BUENA.
     ──────────────────────────────────────────────────────────────────
     La v899 hizo bien la mitad de arriba —la casilla dice SIN MEDIR en vez
     de un 0 % falso— y destapó la de abajo sin darse cuenta: los doce
     chequeos cruzados leen esa casilla con `cruceEn`, que devolvía la
     CADENA «SIN MEDIR». Una cadena es verdadera, así que el chequeo la
     tomaba por un valor y salía impreso

       «PASA · 51 cruces por km² (lámina A) · SIN MEDIR (lámina B)»

     —pasando contra un lado que no existe, que es literalmente el error
     típico que ese mismo panel nombra dos renglones más abajo—.

     Esta suite es donde vive el material: su segundo lote no tiene una sola
     huella sobre la cuadra, así que el paramento sale SIN MEDIR de verdad.
     En `tdoslaminas` los dos lados están medidos y la comprobación pasaría
     por no tener nada que rechazar. */
  console.log('\n  -- §2 · un chequeo no PASA contra SIN MEDIR (v910) --');
  const filasCoh = (htm) => {
    const out = [];
    String(htm || '').replace(/<li class="coh-([a-z-]+)[^"]*">([\s\S]*?)<\/li>/g,
      (todo, est, cuerpo) => { out.push({ est: est, txt: cuerpo.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }); return ''; });
    return out;
  };
  const coh = filasCoh(String(r.docSinHuellas || ''));
  T('los chequeos de coherencia se leen del papel de esa hoja',
    coh.length >= 10, coh.length + ' filas leídas');
  const malos = coh.filter(x => x.est === 'pasa' && /SIN MEDIR/i.test(x.txt)).map(x => x.txt.slice(0, 120));
  T('ningún chequeo marcado «pasa» tiene un lado en SIN MEDIR',
    malos.length === 0, malos.length ? malos.join(' · ') : 'ninguno');
  /* Y la otra mitad: no basta con dejar de decir «pasa». El chequeo que no
     se pudo correr tiene que salir como sin dato y nombrar qué lo llenaría,
     que es lo que §2 pide con esas palabras. */
  const trama = coh.filter(x => /trama y el paramento/i.test(x.txt))[0];
  T('el de la trama sale sin dato y nombra la plantilla que lo llena',
    !!trama && trama.est === 'sin-dato' && /Actividad en primer piso/.test(trama.txt),
    trama ? trama.est + ' · ' + trama.txt.slice(0, 150) : 'no sale el chequeo');
  /* Y lo que de verdad importa: que esa casilla ya no cierre en una
     recomendación de proyecto sobre una capa vacía. */
  T('y no concluye «frente roto» sobre una cuadra que nadie mapeó',
    !!pSin && !/frente roto|cerrar la cuadra/.test(pSin.v + ' ' + pSin.l),
    pSin ? (pSin.v + ' · ' + pSin.l).slice(0, 110) : '—');

  /* ══ v934 · LA TERCERA RAMA: LA MISMA CUADRA, YA CAMINADA ═══════════
     La hoja promete, en la casilla que sale SIN MEDIR, que «esta casilla se
     calcula sola» cuando alguien llene la plantilla. Esto mide esa promesa.

     La guarda de MATERIAL va primero (v920): sin la cuadra del lote medida
     —que es lo que `laCuadraDelLote` necesita y `tpostsector` no tiene— todo
     lo de abajo pasaría por no tener nada que rechazar. */
  console.log('\n  -- §934 · la plantilla de campo llena la casilla --');
  T('MATERIAL · la cuadra sin huellas está medida y la puerta se pinta',
    !!r.paramAntes && r.paramAntes.origen === 'mapa' &&
      Number(r.paramAntes.edificios) === 0 && r.puertaAct === true,
    r.paramAntes
      ? ('origen ' + r.paramAntes.origen + ' · ' + r.paramAntes.edificios +
         ' huellas · puerta ' + r.puertaAct)
      : 'sin cuadra medida');

  /* Las tres rechazan, y cada una DICE POR QUÉ: sin mirar el aviso, un
     rechazo por el motivo equivocado pasaría igual —es medir otra cosa de la
     que se dice medir—. */
  T('una fila sin sus medidas no se guarda a medias, y dice qué falta',
    r.rechazoSinMedida !== 'ok' && /frente total/.test(r.avisoSinMedida || ''),
    r.rechazoSinMedida + ' · ' + (r.avisoSinMedida || '(sin aviso)').slice(0, 90));
  T('ni una con más frente activo que frente total, y lo dice con la cifra',
    r.rechazoActivoMayor !== 'ok' && /no pueden pasarse del frente total: 120 de 80/.test(r.avisoActivoMayor || ''),
    r.rechazoActivoMayor + ' · ' + (r.avisoActivoMayor || '(sin aviso)').slice(0, 90));
  /* La que protege la ESCALA: con varias cuadras hay que decir cuál es la
     del lote. Promediarlas sería publicar una cifra del sector donde va una
     del predio (v854), y esta casilla está rotulada «predio». */
  T('con varias cuadras exige decir cuál es la del lote, por la escala',
    r.rechazoSinMarcar !== 'ok' && /cuál de las cuadras es la del lote/.test(r.avisoSinMarcar || '') &&
      /sector|predio/.test(r.avisoSinMarcar || ''),
    r.rechazoSinMarcar + ' · ' + (r.avisoSinMarcar || '(sin aviso)').slice(0, 120));
  /* Un rango al revés se imprimiría «entre el 14 y el 12», que es una cifra
     correcta dicha de una manera que no se puede leer (v874). */
  T('ni un rango de fechas al revés, y dice por qué',
    r.rechazoRangoAlReves !== 'ok' && /no sea anterior a su inicio/.test(r.avisoRango || ''),
    (r.avisoRango || '(sin aviso)').slice(0, 120));

  T('con la cuadra caminada, la plantilla queda guardada con su procedencia',
    r.guardoAct === true && (r.campoGuardado || []).length === 1 &&
      r.campoGuardado[0].filas === 1 && r.campoGuardado[0].quien === 'Ana Ruiz' &&
      r.campoGuardado[0].desde === '2026-09-12' && r.campoGuardado[0].hasta === '2026-09-14',
    JSON.stringify(r.campoGuardado || []));

  /* ── LA PLANTILLA REPARTIDA (v949) ──────────────────────────────────────
     Dos cuadras, dos personas, y la marcada es la de Ana. La guarda de
     MATERIAL va primero (v920): sin la segunda persona anotada y sin las dos
     cuadras, las de abajo pasarían por no tener nada que rechazar. */
  const AR = r.actRepartida || {}, PR = r.paramRepartido || {};
  T('MATERIAL · dos cuadras con dos nombres, y la marcada no es la de quien responde',
    r.guardoRepartida === true && r.hayFormulario === true && (AR.filas || []).length === 2 &&
      ((AR.quienes || {}).nombres || []).length === 2 && AR.estado === 'ok' &&
      ((AR.quienes || {}).nombres || []).indexOf('Ana Ruiz') < 0,
    AR.estado + ' · ' + (AR.filas || []).length + ' filas · ' +
    JSON.stringify((AR.quienes || {}).nombres || []));

  /* Y acá está lo que de verdad guarda: la cifra sale de UNA fila, así que su
     procedencia es la de ESA fila. Con la lista entera, los 43 % que midió Ana
     llevarían también el nombre de Luis, que midió otra cuadra — declarar mal
     la procedencia es la falta de la v867, y acá con la ropa de una mejora. */
  T('la cifra de la cuadra del lote la firma quien midió ESA cuadra, no la lista ni quien responde',
    PR.quien === 'Marta Peña' && PR.pctLleno === 43,
    PR.pctLleno + ' % firmado por «' + PR.quien + '»');
  T('y la lista completa se conserva, para poder decir que se repartió',
    (PR.quienes || []).length === 2 && PR.repartida === true &&
      (PR.quienes || []).indexOf('Luis Ortega') >= 0,
    JSON.stringify(PR.quienes || []) + ' · repartida ' + PR.repartida);
  T('la puerta dice quiénes levantaron las dos y cuál firma la cifra',
    /repartieron|levantaron/i.test(r.puertaRepartida || '') &&
      /Luis Ortega/.test(r.puertaRepartida || '') &&
      /Marta Peña/.test(r.puertaRepartida || ''),
    (r.puertaRepartida || '(sin texto)').replace(/\s+/g, ' ').slice(0, 200));

  /* 34 de 80 m son 43 %, y NO el 0 % de las huellas. La cifra que cambia es
     la del papel, así que el origen también tiene que cambiar: sin él, una
     medida de campo y una de OpenStreetMap se leen igual (v867). */
  T('y el paramento pasa a medirse en campo, no en el mapa',
    !!r.paramDespues && r.paramDespues.origen === 'campo' &&
      r.paramDespues.pctLleno === 43 && r.paramDespues.pctLlenoMapa === 0,
    r.paramDespues
      ? (r.paramDespues.pctLleno + ' % · origen ' + r.paramDespues.origen +
         ' · el mapa daba ' + r.paramDespues.pctLlenoMapa + ' %')
      : 'sin paramento');

  const pCam = paramDe(String(r.docCaminada || ''));
  T('la casilla del papel deja de decir SIN MEDIR y trae la cifra',
    !!pCam && !/SIN MEDIR/.test(pCam.v) && /43 % del frente de la cuadra/.test(pCam.v),
    pCam ? pCam.v : 'no sale el cruce');
  /* La procedencia VIAJA con la cifra: el rango de días es el mismo que los
     edificios de campo ya imprimían, y por la misma función (v879). */
  T('y dice que se midió en campo, con su rango de días',
    !!pCam && /medido en campo/.test(pCam.v) &&
      /entre el 2026-09-12 y el 2026-09-14/.test(pCam.v),
    pCam ? pCam.v.slice(0, 140) : '—');

  /* Y el chequeo cruzado que la v910 dejó en «sin dato» ya se puede correr:
     era la otra mitad de la promesa. */
  const cohCam = filasCoh(String(r.docCaminada || ''));
  const tramaCam = cohCam.filter(x => /trama y el paramento/i.test(x.txt))[0];
  T('el chequeo cruzado que esperaba la plantilla ya se corre',
    !!tramaCam && tramaCam.est !== 'sin-dato' && !/SIN MEDIR/i.test(tramaCam.txt),
    tramaCam ? tramaCam.est + ' · ' + tramaCam.txt.slice(0, 120) : 'no sale el chequeo');

  console.log('\n  -- §10 · una sola fuente por magnitud: los edificios --');
  /* «Es el mismo dato contado dos veces en el mismo código». Este sector es
     el único de la batería que puede producirlo: trae SESENTA casas como
     punto —que la consulta de usos ve y la del trazado no pide, porque pide
     `way` y `relation`— y TREINTA Y SEIS huellas con sus pisos. Hasta la v905
     la ficha se quedaba con la lista mayor (60, ninguna con pisos) y la
     lámina con la que trajera pisos (36, todas con pisos), así que las dos
     imprimían una cifra distinta bajo el mismo nombre sobre el mismo sector.

     En el sector de `tdoslaminas` las dos reglas coinciden, así que allá esto
     habría pasado en verde por no tener nada que rechazar. */
  const nDe = (t, re) => { const m = new RegExp(re).exec(String(t || '')); return m ? Number(m[1].replace(/\./g, '')) : null; };
  const fich = String(r.fichaTexto || '');
  const edFicha = nDe(fich, 'Se cuentan los ([\\d.]+) edificios') ||
                  nDe(fich, 'Se encontraron ([\\d.]+) edificio') ||
                  nDe(fich, '([\\d.]+) edificios en el área');
  const edLamina = nDe(txt, 'Se cuentan los ([\\d.]+) edificios') ||
                   nDe(txt, 'de ([\\d.]+) edificios traen la altura');
  T('la ficha imprime un conteo de edificios', edFicha != null, edFicha == null ? 'no lo imprime' : edFicha);
  T('la lámina imprime un conteo de edificios', edLamina != null, edLamina == null ? 'no lo imprime' : edLamina);
  T('y las dos cuentan LOS MISMOS, que es lo que §10 pide',
    edFicha != null && edLamina != null && edFicha === edLamina,
    'ficha ' + edFicha + ' · lámina ' + edLamina);
  /* Y la otra mitad: que el conteo diga de dónde salió y qué no vio la otra
     consulta. Sin esto el arreglo podría ser callar una de las dos, y un
     número sin procedencia es lo que la v867 prohíbe. */
  T('y el conteo declara de qué consulta sale',
    /Se cuentan los [\d.]+ edificios que trae la consulta del (trazado|usos)/.test(txt),
    /Se cuentan[^.]{0,120}\./.exec(txt) ? /Se cuentan[^.]{0,120}\./.exec(txt)[0] : 'no lo dice');
  T('y nombra los que la otra consulta ve y esta no, con su razón',
    /La consulta de usos ve [^.]*\b(building=yes|sin huella)/.test(txt) ||
    /mapeados como PUNTO, sin huella/.test(txt),
    /La consulta de usos ve[^.]{0,150}\./.exec(txt) ? /La consulta de usos ve[^.]{0,150}\./.exec(txt)[0].slice(0, 130) : 'no los nombra');

  T('y la página no soltó errores', err.length === 0, err.slice(0, 2).join(' · ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' comprobaciones fallaron' : 'todo en verde'));
  process.exit(mal ? 1 : 0);
})();
