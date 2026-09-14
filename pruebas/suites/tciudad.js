const E = require('../entorno.js');
/* §11 · LA REFERENCIA MUNICIPAL DE OPENSTREETMAP · tres ramas, tres acciones
   ────────────────────────────────────────────────────────────────────────
   El pliego de ajustes v2 lo llama la prioridad de contenido de esta tanda:
   la lámina compara con la ciudad la población, la densidad de población, la
   pirámide y el reparto por sexo —todo lo que sale del censo desde la v876—
   y declara que no puede comparar lo que sale de OpenStreetMap. §11 pide
   correr el análisis sobre el municipio UNA vez, guardarlo, y usarlo de
   columna de la derecha.

   Por qué una suite propia y no unas aserciones más en `tdoslaminas`:
   aquella suite no corre la referencia municipal —es una consulta de mil
   kilómetros cuadrados y una espera más del limitador de Overpass— y sobre
   todo no puede tener las TRES ramas a la vez. Son tres estados distintos
   que piden tres acciones distintas, y una sola corrida solo puede enseñar
   uno:

     · `ok`        — la referencia salió: los pares se imprimen y la lista de
                     carencias se encoge sola.
     · `truncada`  — el conteo tocó el tope de salida de la consulta, así que
                     la DENSIDAD no se publica y se dice por qué. Publicarla
                     sería dar una densidad por debajo de la real sin manera
                     de saber cuánto.
     · `sin-area`  — la capa del censo no publica el área del municipio, así
                     que no hay ni sobre qué correrla ni con qué dividir.

   Cada rama corre en su propio contexto porque cada una necesita un doble
   del DANE distinto: el tope de salida sale del ÁREA del municipio
   (`escalaDeConsulta`), y el área es justamente lo que las separa.

   Y la comprobación que sostiene a las otras, que es la lección de la v876
   con `atributosCiudad`: **el municipio de mentira contesta cosas distintas
   del sector.** Si la corrida municipal devolviera los mismos usos que la
   del sector, todas las diferencias darían cero y una comprobación sobre la
   comparación pasaría sin comparar nada.                                   */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';

/* El sector: un cuadrado de unos 560 m de lado en el centro del municipio de
   mentira, cuya envolvente va de 7,83 a 7,96 y de −72,55 a −72,44. */
const C = { lat: 7.8950, lng: -72.4950 }, L = 0.0025;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];
const GLAT = m => m / 110540, GLNG = m => m / (111320 * Math.cos(C.lat * Math.PI / 180));
const P = (dx, dy) => ({ lat: C.lat + GLAT(dy), lng: C.lng + GLNG(dx) });

/* CUÁL consulta es cuál. El radio del sector son unos 390 m; el del
   municipio sale de su área censada —4.425 m con los 61,5 km² del doble,
   977 m con los 3 km² de la rama truncada—. El corte va en 700 m, lejos de
   los dos, y así la misma suite puede servir dos sectores distintos sin
   depender de contar consultas en orden. */
const CORTE_MUNICIPAL = 700;
/* La consulta viaja en el cuerpo como `data=` URL-codificado, así que en el
   texto crudo los dos puntos son `%3A` y `around:4425` no casa. Costó una
   corrida entera: el doble servía los usos del SECTOR a la consulta
   municipal, la referencia salía con 220 usos y la comprobación de la rama
   truncada medía un municipio que nunca se consultó. Se decodifica antes de
   mirar. */
const radioDe = q => {
  let t = String(q || '');
  try { t = decodeURIComponent(t.replace(/\+/g, ' ')); } catch (e) {}
  const m = /around:(\d+)/.exec(t);
  return m ? Number(m[1]) : 0;
};

/* ── Los usos del SECTOR ────────────────────────────────────────────────
   Un barrio bien servido: comercio, y los cuatro equipamientos que el motor
   cuenta, todos con puntos mapeados. Hacen falta los cuatro porque el par de
   cobertura solo se imprime cuando LAS DOS columnas tienen al menos un punto
   —comparar contra una capa vacía es la regla de la v875 aplicada a la
   columna de la derecha—, así que un sector sin colegios dejaría esa mitad
   sin ejercitar y la comprobación pasaría por no tener nada que rechazar. */
const COMERCIO = ['bakery', 'hairdresser', 'butcher', 'clothes', 'hardware', 'greengrocer'];
const usosSector = [];
for (let i = 0; i < 200; i++) {
  const a = i * 11 * Math.PI / 180, d = 40 + (i % 7) * 45;
  const p = P(Math.cos(a) * d, Math.sin(a) * d);
  usosSector.push({ type: 'node', id: 10000 + i, lat: p.lat, lon: p.lng,
    tags: { name: 'Local ' + i, shop: COMERCIO[i % COMERCIO.length] } });
}
const EQUIPOS = [
  { t: { amenity: 'school', name: 'Colegio del barrio' }, xy: [-120, 90] },
  { t: { amenity: 'school', name: 'Jardín infantil' }, xy: [150, -60] },
  { t: { amenity: 'pharmacy', name: 'Droguería La Salud' }, xy: [60, 140] },
  { t: { amenity: 'clinic', name: 'Centro de salud' }, xy: [-180, -100] },
  { t: { leisure: 'park', name: 'Parque principal' }, xy: [0, 0] },
  { t: { leisure: 'pitch', name: 'Cancha del barrio' }, xy: [-90, 170] },
  { t: { shop: 'supermarket', name: 'Supermercado Centro' }, xy: [130, 110] },
  { t: { shop: 'convenience', name: 'Tienda de la esquina' }, xy: [-160, 20] }
];
EQUIPOS.forEach(function (e, i) {
  const p = P(e.xy[0], e.xy[1]);
  usosSector.push({ type: 'node', id: 11000 + i, lat: p.lat, lon: p.lng, tags: e.t });
});
/* La malla de calles, con vértice compartido en los cruces (v859). */
const viasSector = []; let vid = 500000;
{
  const NX = 6, NY = 6, PASO = 110;
  const nodo = (ix, iy) => P(-275 + ix * PASO, -275 + iy * PASO);
  for (let iy = 0; iy < NY; iy++) {
    const pts = []; for (let ix = 0; ix < NX; ix++) pts.push(nodo(ix, iy));
    viasSector.push({ type: 'way', id: vid++, tags: { highway: 'residential', name: 'Calle ' + iy },
      geometry: pts.map(p => ({ lat: p.lat, lon: p.lng })),
      center: { lat: pts[2].lat, lon: pts[2].lng } });
  }
  for (let ix = 0; ix < NX; ix++) {
    const pts = []; for (let iy = 0; iy < NY; iy++) pts.push(nodo(ix, iy));
    viasSector.push({ type: 'way', id: vid++, tags: { highway: 'residential', name: 'Carrera ' + ix },
      geometry: pts.map(p => ({ lat: p.lat, lon: p.lng })),
      center: { lat: pts[2].lat, lon: pts[2].lng } });
  }
}

/* ── Los usos del MUNICIPIO ─────────────────────────────────────────────
   Repartidos por todo el círculo municipal, y DELIBERADAMENTE más ralos que
   los del sector: un municipio tiene su centro denso y kilómetros de borde
   sin nada, y el sector de prueba es de los densos. Si el municipio saliera
   igual de denso, las diferencias darían cero y la comparación pasaría sin
   comparar — es la lección de la v876 con `atributosCiudad`, dicha para
   OpenStreetMap. */
function usosMunicipio(n, radioM) {
  const out = [];
  for (let i = 0; i < n; i++) {
    /* Espiral de Fermat: reparte parejo por área sin amontonar en el centro,
       que es lo que hace un anillo de ángulo constante. */
    const t = (i + 0.5) / n, r = radioM * Math.sqrt(t), a = i * 2.39996;
    const p = { lat: C.lat + GLAT(Math.sin(a) * r), lng: C.lng + GLNG(Math.cos(a) * r) };
    let tags;
    if (i % 47 === 0) tags = { amenity: 'school', name: 'Colegio ' + i };
    else if (i % 31 === 0) tags = { amenity: 'pharmacy', name: 'Droguería ' + i };
    else if (i % 53 === 0) tags = { leisure: 'park', name: 'Parque ' + i };
    else if (i % 37 === 0) tags = { shop: 'supermarket', name: 'Mercado ' + i };
    else tags = { name: 'Local ' + i, shop: COMERCIO[i % COMERCIO.length] };
    out.push({ type: 'node', id: 900000 + i, lat: p.lat, lon: p.lng, tags: tags });
  }
  return out;
}

const cotaDe = ln => 300 + Math.round(30 * Math.sin(ln * 800));

/* Una corrida entera: monta el contexto, analiza el sector, corre la
   referencia municipal con el botón de verdad y compone la lámina B. Las
   tres ramas usan la misma, cambiando el doble del DANE y cuántos elementos
   contesta la consulta municipal. */
async function corrida(b, opciones) {
  const o = opciones || {};
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'martarojas', rol: 'admin',
        es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('pcr_fichas_v1');
      localStorage.removeItem('aia_overpass_cache_v1');
      /* Las dos referencias guardadas, fuera: sin esto la segunda corrida
         serviría la del primer contexto y mediría una caché, no una rama. */
      localStorage.removeItem('urbis_censo_ciudad_v2');
      localStorage.removeItem('urbis_ciudad_osm_v1');
    } catch (e) {}
  });
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route(/locationiq\.com/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ address: { city: 'Cúcuta', state: 'Norte de Santander', country: 'Colombia', suburb: 'Centro' } }) }));

  let consultasMunicipales = 0, elementosServidos = 0;
  await ctx.route(/overpass/, r => {
    const q = (r.request().postData() || '') + r.request().url();
    const esMunicipal = radioDe(q) > CORTE_MUNICIPAL;
    let elementos;
    if (esMunicipal) {
      consultasMunicipales++;
      elementos = usosMunicipio(o.nMunicipio || 1400, o.radioMunicipal || 4400);
      elementosServidos = elementos.length;
    } else {
      elementos = /out(\+|%20|\s)geom/.test(q) ? viasSector : usosSector.concat(viasSector);
    }
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: elementos }) });
  });
  await E.rutaDane(ctx, o.censo);
  await ctx.route(/elevation/, r => { const u = new URL(r.request().url());
    const lngs = (u.searchParams.get('locations') || '').split('|');
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elevation: lngs.map(cotaDe) }) }); });

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);
  const r = await pg.evaluate(async (D) => {
    const { C, POL } = D, o = {}, esperar = ms => new Promise(x => setTimeout(x, ms));
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    window.map.setView([C.lat, C.lng], 16); await esperar(500);
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
    const asa = H().querySelector('[data-pcr="agrandar"]'); if (asa) { asa.click(); await esperar(400); }

    /* La lámina ANTES de correr la referencia: es la mitad que demuestra que
       la corrida cambia el papel. Sin ella, «el par está» no distingue un
       par que llegó de uno que estaba desde siempre. */
    const verLamina = async () => {
      const bl = H().querySelector('[data-pcr="lamina-doble"]') || H().querySelector('[data-pcr="lamina-ver"]');
      if (bl) { bl.click(); await esperar(1400); }
      const d = capturado; capturado = ''; return d;
    };
    o.antes = await verLamina();

    /* El botón de verdad, en su pestaña. Nada de llamar a la función por un
       lado: es la regla de la v871 —para cambiar el estado desde una prueba
       se usa el botón—, y de paso comprueba que el bloque exista y que el
       botón esté donde alguien lo va a buscar. */
    const tab = H().querySelector('[data-pcr="pestana"][data-t="ambiente"]');
    if (tab) { tab.click(); await esperar(400); }
    const bc = H().querySelector('[data-pcr="ciudad-osm"]');
    o.hayBoton = !!bc;
    /* Las pistas de SU bloque, no las de la pestaña entera: leyendo toda la
       pestaña, la de «El terreno» daba por buena esta comprobación. Es la
       lección de la v874 con `.hit`, dicha en la ficha. */
    o.pistaAntes = (function () {
      const b = document.getElementById('pcr-ciudad');
      return b ? (b.textContent || '') : '';
    })();
    if (bc) {
      await esperar(5200);   // el limitador de Overpass, cinco segundos
      bc.click();
      for (let i = 0; i < 200; i++) {
        await esperar(300);
        const e = (R.estado ? R.estado() : {});
        if (!e.ciudadOSMCargando) break;
      }
      await esperar(600);
    }
    o.estado = R.estado ? R.estado() : {};
    o.panel = (function () {
      const s = [...H().querySelectorAll('.pcr-tab')].filter(x => x.getAttribute('data-tab') === 'ambiente')[0];
      return s ? (s.textContent || '') : '';
    })();
    o.despues = await verLamina();
    return o;
  }, { C, POL });
  await pg.close(); await ctx.close();
  r.consultasMunicipales = consultasMunicipales;
  r.elementosServidos = elementosServidos;
  r.err = err;
  return r;
}

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });

  /* Rama 1 · la corrida que sale bien, con el municipio del doble tal cual:
     61,5 km² censados, tope de salida de 14.000 y 1.400 elementos servidos,
     así que ni de lejos se toca el tope. */
  const R1 = await corrida(b, { nMunicipio: 1400, radioMunicipal: 4400 });

  /* Rama 2 · el conteo que toca el TOPE. Un municipio de 3 km² censados
     —`escalaDeConsulta` le da tope 3.000— al que la consulta le devuelve
     exactamente 3.000 elementos. No es un número inventado para la prueba:
     es lo que Overpass hace cuando la unión pasa del `out` que se le pidió.
     El radio le sale en 977 m, por debajo del corte de 700… no: por encima,
     que es lo que hace falta para que la suite sepa cuál consulta es cuál. */
  const R2 = await corrida(b, {
    nMunicipio: 3000, radioMunicipal: 950,
    censo: { ciudad: Object.assign({}, E.CIUDAD, { areaM2: 3_000_000 }) }
  });

  /* Rama 3 · la capa del censo no publica el área del municipio. No hay ni
     sobre qué correr la consulta ni con qué dividir, y son dos cosas: la
     segunda es la que hace que ni siquiera valga la pena salir a la red. */
  const R3 = await corrida(b, {
    nMunicipio: 1400, radioMunicipal: 4400,
    censo: { ciudad: Object.assign({}, E.CIUDAD, { areaM2: 0 }) }
  });

  await b.close();

  try { fs.writeFileSync(E.TRABAJO + 'lamina-ciudad.html', R1.despues || '', 'utf8'); } catch (e) {}

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };
  const plano = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');

  /* La caja de la comparación, recortada: es la lección de la v854 y de la
     v879 —pescar el primer «por ha» del documento agarra la medición en un
     sitio y el estándar en otro—. Se corta del `<h2>` al siguiente `caja`. */
  const cajaCiudad = (h) => {
    const d = String(h || '');
    const i = d.indexOf('El sector dentro de la ciudad');
    if (i < 0) return '';
    const j = d.indexOf('<section class="caja', i);
    return d.slice(i, j < 0 ? d.length : j);
  };
  const paresDe = (h) => {
    const out = [];
    const re = /<div class="par[^"]*"><i class="par-k">([^<]*)<\/i><b class="par-s">([^<]*)<\/b><b class="par-c">([^<]*)<\/b><small class="par-d">([^<]*)<\/small><\/div>/g;
    let m; while ((m = re.exec(cajaCiudad(h)))) out.push({ k: m[1], s: m[2], c: m[3], d: m[4] });
    return out;
  };

  console.log('\n  -- la corrida municipal existe, se pide y cambia el papel --');
  T('el bloque de la referencia municipal está en la ficha, con su botón', R1.hayBoton, R1.hayBoton ? 'sí' : 'no está');
  T('y dice ANTES de gastar el tiempo que es una consulta grande',
    /consulta grande/.test(R1.pistaAntes) && /una sola vez/.test(R1.pistaAntes),
    R1.pistaAntes.slice(0, 120) || '—');
  T('la consulta municipal salió, y una sola vez', R1.consultasMunicipales === 1,
    R1.consultasMunicipales + ' consultas · ' + R1.elementosServidos + ' elementos');
  const CO1 = (R1.estado || {}).ciudadOSM || null;
  T('y volvió con estado ok, con su fecha', !!CO1 && CO1.estado === 'ok' && /^\d{4}-\d{2}-\d{2}$/.test(CO1.fecha || ''),
    CO1 ? (CO1.estado + ' · ' + (CO1.fecha || 'sin fecha') + ' · ' + CO1.usos + ' usos') : 'no hay referencia');

  console.log('\n  -- §11 · los pares que antes no se podían imprimir --');
  const pAntes = paresDe(R1.antes), pDesp = paresDe(R1.despues);
  const busca = (ps, re) => ps.filter(x => re.test(x.k))[0] || null;
  const dens = busca(pDesp, /Densidad de usos/);
  T('antes de correrla, la hoja NO compara la densidad de usos', !busca(pAntes, /Densidad de usos/),
    pAntes.length + ' pares antes');
  T('después, sí, con sector, ciudad y diferencia', !!dens && !!dens.s && !!dens.c && !!dens.d,
    dens ? (dens.s + ' | ' + dens.c + ' | ' + dens.d) : 'no sale el par');
  /* La mitad que sostiene a la otra: si el municipio contestara lo mismo que
     el sector, la diferencia daría 0 % y esto pasaría sin comparar nada. */
  T('y la ciudad NO sale igual que el sector: hay diferencia que leer',
    !!dens && dens.s !== dens.c && !/^\+?0(,0)? %$/.test(dens.d),
    dens ? dens.d : '—');
  const cobs = pDesp.filter(x => /a \d+ min$/.test(x.k));
  T('la cobertura de equipamientos también se compara, categoría por categoría',
    cobs.length >= 2, cobs.map(x => x.k + ' ' + x.s + '/' + x.c).join(' · ') || 'ninguna');
  T('y ninguna se imprime con el nombre escapado dos veces',
    !/&(amp|aacute|iacute|oacute);/.test(cobs.map(x => x.k).join(' ')),
    cobs.map(x => x.k).join(' · ').slice(0, 90) || '—');

  console.log('\n  -- de dónde sale la columna de ciudad, dicho donde se lee --');
  const txt1 = plano(cajaCiudad(R1.despues));
  T('la hoja dice que salió de correr el mismo análisis sobre el municipio, y cuándo',
    /MISMO análisis sobre el municipio/.test(txt1) && txt1.indexOf(CO1 ? CO1.fecha : '@@') > 0,
    txt1.slice(txt1.indexOf('MISMO análisis'), txt1.indexOf('MISMO análisis') + 110) || '—');
  T('y que es lo que OpenStreetMap tiene mapeado, no un inventario',
    /lo que OpenStreetMap tiene mapeado/.test(txt1) && /mismo sesgo de mapeo/.test(txt1));
  T('y que el círculo no es el límite del municipio',
    /no es el límite del municipio/.test(txt1),
    /no es el límite del municipio/.test(txt1) ? 'lo dice' : 'lo calla');

  console.log('\n  -- la lista de carencias se ENCOGE sola (v861, v876) --');
  const faltaAntes = plano(cajaCiudad(R1.antes)), faltaDesp = txt1;
  T('antes, la hoja pide la corrida municipal', /Densidad de usos y cobertura de equipamientos de la ciudad/.test(faltaAntes),
    /Densidad de usos y cobertura/.test(faltaAntes) ? 'la pide' : 'no la pide');
  T('y después ya NO la declara faltando: es la mentira de la v861',
    !/Densidad de usos y cobertura de equipamientos de la ciudad/.test(faltaDesp),
    /Densidad de usos y cobertura/.test(faltaDesp) ? 'la sigue pidiendo' : 'se encogió');
  /* Y la otra mitad, que es la que distingue encoger de borrar: el espacio
     público sigue faltando y con SU razón, que no es la misma. */
  T('el espacio público sigue declarado, y con su propia razón',
    /El espacio público de la ciudad/.test(faltaDesp) && /polígonos/.test(faltaDesp),
    /El espacio público de la ciudad/.test(faltaDesp) ? 'declarado' : 'se lo llevó por delante');

  /* La regla de la v874 en la columna de diferencia: una razón grande se dice
     en VECES. Un barrio denso contra su municipio da «+18.178 %», que es
     cierto y no significa nada. Va acá y no en `tdoslaminas` porque es este
     par el que la produce: sin la referencia municipal, ningún par de la hoja
     pasa del 300 %, y la comprobación pasaría por no tener nada que
     rechazar. */
  console.log('\n  -- una razón grande se dice en veces, no en porcentaje (v874) --');
  T('la diferencia de la densidad de usos no se imprime como un porcentaje largo',
    !!dens && !/\d{4}/.test(dens.d), dens ? dens.d : '—');
  T('y se dice en veces, que es como se lee', !!dens && /veces/.test(dens.d),
    dens ? dens.d : '—');

  console.log('\n  -- §11 · el conteo que toca el tope no publica densidad --');
  const CO2 = (R2.estado || {}).ciudadOSM || null;
  const txt2 = plano(cajaCiudad(R2.despues));
  T('la corrida se hizo y se marcó como truncada', !!CO2 && CO2.estado === 'ok' && CO2.truncada === true,
    CO2 ? (CO2.usos + ' usos · tope ' + CO2.tope + ' · truncada ' + CO2.truncada) : 'no hay referencia');
  T('y la densidad de usos NO se publica', !!CO2 && CO2.usosPorHa == null && !paresDe(R2.despues).some(x => /Densidad de usos/.test(x.k)),
    CO2 ? String(CO2.usosPorHa) : '—');
  T('la hoja dice por qué, con el tope y con la consecuencia',
    /tope de salida/.test(txt2) && /por debajo de la real/.test(txt2),
    txt2.indexOf('tope de salida') > 0 ? txt2.slice(txt2.indexOf('tope de salida') - 30, txt2.indexOf('tope de salida') + 120) : 'no lo dice');
  /* Truncada NO es «no se pudo»: la cobertura se compara igual, porque un
     porcentaje de área cubierta no se hunde por que falte cola de lista. */
  T('y la cobertura de equipamientos se compara igual',
    paresDe(R2.despues).some(x => /a \d+ min$/.test(x.k)),
    paresDe(R2.despues).filter(x => /a \d+ min$/.test(x.k)).length + ' categorías');

  console.log('\n  -- §11 · sin área censada no se sale a la red --');
  const CO3 = (R3.estado || {}).ciudadOSM || null;
  T('no hay referencia municipal', !CO3 || CO3.estado !== 'ok', CO3 ? CO3.estado : 'ninguna');
  T('y NO se gastó una consulta municipal de dos minutos para averiguarlo',
    R3.consultasMunicipales === 0, R3.consultasMunicipales + ' consultas');
  T('el panel dice qué falta, nombrando el campo y no un error genérico',
    /Shape__Area/.test(R3.panel) || /área censada/.test(R3.panel),
    (R3.panel.match(/No se pudo[^.]{0,140}/) || ['—'])[0]);
  T('y la hoja vuelve a pedir la corrida municipal, que es lo que hay que hacer',
    /Densidad de usos y cobertura de equipamientos de la ciudad/.test(plano(cajaCiudad(R3.despues))),
    /Densidad de usos y cobertura/.test(plano(cajaCiudad(R3.despues))) ? 'la pide' : 'no la pide');

  const errs = [].concat(R1.err, R2.err, R3.err);
  T('y ninguna de las tres corridas soltó errores', errs.length === 0, errs.slice(0, 2).join(' · ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' comprobaciones fallaron' : 'todo en verde'));
  process.exit(mal ? 1 : 0);
})();
