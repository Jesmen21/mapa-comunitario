const ENT = require('../entorno.js');
// ANÁLISIS DEL SECTOR EN MODO EDUCATIVO
//
// Lo que se comprueba no es que "salga algo": es que el estudiante reciba el
// MISMO análisis que una empresa —población del DANE, flujo, calor, rubros,
// oportunidades, FODA— corriendo sobre lo que él mapeó, y que el módulo diga
// con cuántos puntos lo hizo antes de soltar las cifras. Un curso que mapeó
// ocho puntos no puede leer "flujo 18/100" como un hecho del barrio.
const { chromium } = require(ENT.MODULOS + '/playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const REPO = process.env.REPO || ENT.RAIZ;

const LEAFLET_STUB = `
window.L = (function(){
  const cap = () => ({ addTo(){return this;}, clearLayers(){return this;}, addLayer(){return this;},
                       remove(){return this;}, removeFrom(){return this;}, bindPopup(){return this;},
                       bindTooltip(){return this;}, on(){return this;}, off(){return this;},
                       setLatLng(){return this;}, setRadius(){return this;}, setStyle(){return this;},
                       getBounds(){return {};}, setLatLngs(){return this;},
                       getLatLng(){return {lat:0,lng:0};}, openPopup(){return this;},
                       closePopup(){return this;}, setContent(){return this;},
                       bringToFront(){return this;}, getElement(){return null;},
                       setIcon(){return this;}, setOpacity(){return this;}, setZIndexOffset(){return this;} });
  const mapa = () => ({ setView(){return this;}, on(){return this;}, off(){return this;}, once(){return this;},
                        addLayer(){return this;}, removeLayer(){return this;}, hasLayer(){return false;},
                        fitBounds(){return this;}, invalidateSize(){return this;}, getZoom(){return 16;},
                        getCenter(){return {lat:7.9168,lng:-72.4727};}, getContainer(){return document.body;},
                        eachLayer(){}, getSize(){return {x:360,y:640};}, panTo(){return this;},
                        flyTo(){return this;}, setZoom(){return this;}, addControl(){return this;},
                        removeControl(){return this;}, whenReady(f){ if(f) f(); return this; },
                        getBounds(){return {};}, distance(){return 0;}, remove(){return this;},
                        latLngToContainerPoint(){return {x:0,y:0};},
                        containerPointToLatLng(){return {lat:0,lng:0};},
                        getPanes(){return {};}, createPane(){return document.createElement('div');},
                        dragging:{enable(){},disable(){}}, touchZoom:{enable(){},disable(){}},
                        scrollWheelZoom:{enable(){},disable(){}}, doubleClickZoom:{enable(){},disable(){}},
                        boxZoom:{enable(){},disable(){}}, keyboard:{enable(){},disable(){}} });
  const L = { map: mapa, tileLayer: cap, layerGroup: cap, featureGroup: cap, marker: cap,
              circle: cap, circleMarker: cap, polygon: cap, polyline: cap, rectangle: cap,
              divIcon: ()=>({}), icon: ()=>({}), latLngBounds: a=>a,
              latLng:(a,b)=>({lat:a,lng:b}), point:(a,b)=>({x:a,y:b}),
              geoJSON: cap, markerClusterGroup: cap,
              control: Object.assign(()=>cap(), { layers: cap, scale: cap, attribution: cap }),
              DomUtil: { create: (t)=>document.createElement(t||'div'), addClass(){}, removeClass(){} },
              DomEvent: { disableClickPropagation(){}, disableScrollPropagation(){}, stop(){}, on(){} },
              Browser: { mobile:false }, Util: { setOptions(){} } };
  L.tileLayer.wms = cap;
  return L;
})();`;

const TIPOS = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
                '.json':'application/json', '.png':'image/png', '.webmanifest':'application/manifest+json' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const f = path.join(REPO, rel);
  if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});

(async () => {
  /* La página se sirve desde el mismo sitio que las demás pruebas —el
     servidor estático en 8199— y no desde un puerto al azar. No es capricho:
     el motor solo acepta peticiones de orígenes conocidos, y desde
     127.0.0.1:41xxx el navegador ni siquiera manda el análisis. Este servidor
     propio queda para cuando 8199 no esté levantado. */
  const base = ENT.ESTATICO;
  await new Promise(r => server.listen(0, r));
  const b = await chromium.launch({ executablePath: ENT.CHROMIUM });
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, ENT.MOTOR);
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(e.message));

  await pg.route('**/*.openstreetmap.org/**', r => r.abort());
  await pg.route('**/mt1.google.com/**', r => r.abort());
  await pg.route('**/*.basemaps.cartocdn.com/**', r => r.abort());
  await pg.route('**/script.google.com/**', r => r.abort());
  await pg.route('**/sheetdb.io/**', r => r.abort());
  await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ contentType:'text/css', body:'' }));
  await pg.route('**/fonts.gstatic.com/**', r => r.abort());
  await pg.route('**/leaflet*.css', r => r.fulfill({ contentType:'text/css', body:'' }));
  await pg.route('**/leaflet*.js', r => r.fulfill({ contentType:'text/javascript', body: LEAFLET_STUB }));

  /* Las reglas se fueron al repo privado: el motor del navegador ya no
     analiza, le pregunta a la API. Se le da la de este equipo y una licencia
     de prueba, que es exactamente lo que tiene un estudiante con su licencia
     del curso. Sin esto el análisis lanza excepción y la pantalla se queda
     vacía sin decir por qué. */
  await ctx.addInitScript(() => {
    try { localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba'); } catch (e) {}
  });
  await pg.goto(base + '/index.html', { waitUntil: 'load' });
  await pg.waitForFunction(() => !!(window.URBIS_EDU && window.AIA_MOTOR), { timeout: 20000 });
  await pg.evaluate(() => { window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR; });

  // ── El levantamiento de un curso ──────────────────────────────────────
  // Etiquetas tal como las guarda la app: "Uso · Tipo".
  await pg.evaluate(() => {
    const centro = { lat: 7.9168, lng: -72.4727 };
    let id = 0;
    const p = (desc, d, a) => { const rad = a * Math.PI / 180; id++;
      return { lat: String(centro.lat + (d * Math.cos(rad)) / 110540),
               lng: String(centro.lng + (d * Math.sin(rad)) / (111320 * Math.cos(centro.lat * Math.PI / 180))),
               tipo: '🗺️ Matriz de Usos', descripcion: desc + ' | levantado en clase', fecha: '2026-08-20' }; };
    const muchos = (desc, n, d) => Array.from({length:n}, (_, i) => p(desc, d, i * (360 / n)));
    // Registro con la ficha del edificio en su sitio real: al final de la
    // cadena, después del bloque temporal.
    const conFicha = (desc, dist, ang, plantaBaja) => {
      const base = p(desc, dist, ang);
      const usos = window.URBIS_EDIFICIO.todosLosUsos().map(() => 'NO');
      base.descripcion = [desc, 'Bodega X', 'n', 'Bueno', 'Activo', 'N/A']
        .concat(usos)
        .concat(['N/A', 'Aprobado', 'A', 'edu', '0', 'a@b.c', '1', 'C'])
        .concat(['2026-08-20T10:00:00Z', 'N/A', 'Permanente', 'Activo', 'General'])
        .concat(['Concreto reforzado (pórticos o muros)', '1', plantaBaja,
                 '1950 – 1983 (sin norma sismo resistente)']).join(' | ');
      return base;
    };
    window.__eduDatos = [].concat(
      muchos('Residencial · Casa de dos pisos', 30, 220),
      muchos('Comercial · Local pequeño (tienda de barrio)', 7, 180),
      muchos('Comercial · Ropa / calzado', 5, 160),
      [ p('Comercial · Droguería / farmacia', 150, 60) ],
      [ p('Comercial · Panadería / repostería', 140, 100) ],
      [ p('Deportivo · Gimnasio / CrossFit', 130, 35) ],
      [ p('Educativo (Básico/Superior) · Colegio (básica/media)', 260, 200) ],
      [ p('Esp. Público · Plaza / plazoleta', 190, 280) ],
      [ p('Esp. Público · Parque de barrio', 300, 300) ],
      [ p('Transporte (Terminales/Estaciones) · Parada de bus / paradero', 120, 150) ],
      [ p('Ocio / Negocio · Bar', 210, 175) ],
      [ p('Salud (Clínicas/Hospitales) · Centro de salud / CAP', 320, 120) ],
      [ p('Logístico / Almacenamiento · Bodega de almacenamiento', 240, 40) ],
      [ p('Abandono / Ruina · Vivienda abandonada', 200, 20) ],
      [ p('Zona Baldía · Lote urbano sin construir', 230, 10) ],
      [ p('Vías e Infraestructura Vial · Vía principal / arteria', 70, 0) ],
      [ p('Vías e Infraestructura Vial · Ciclorruta', 90, 350) ],
      // Un reporte de situación: NO es un uso del suelo y no debe contarse
      // como actividad del sector.
      [ { lat: String(centro.lat), lng: String(centro.lng + 0.001),
          tipo: '🚨 Alertas y Riesgos Urbanos', descripcion: 'Hueco en la vía | grande', fecha: '2026-08-20' } ],
      // Y una etiqueta que la traducción todavía no cubre.
      [ { lat: String(centro.lat), lng: String(centro.lng + 0.0012),
          tipo: '🗺️ Matriz de Usos', descripcion: 'Uso Inventado · Cosa rara', fecha: '2026-08-20' } ],
      // Dos bodegas con ficha de edificio: la categoría supone fachada ciega,
      // pero el curso fue y vio vitrina. Recorre el camino completo —registro,
      // lectura de ficha, motor, informe— y no solo la tabla de traducción.
      [ conFicha('Logístico / Almacenamiento · Bodega / almacenamiento', 150, 30,
                 'Comercio o local con vitrina'),
        conFicha('Logístico / Almacenamiento · Bodega / almacenamiento', 170, 60,
                 'Comercio o local con vitrina') ]
    );
    window.urbisDatosVisibles = () => window.__eduDatos;
    // Censo con tasa, como lo devuelve la capa de datos en Cúcuta.
    window.__daneMunicipio = null;
    window.AIA_DATOS.consultarDANE = async (lat, lng, radioM, municipio) => {
      window.__daneMunicipio = municipio;
      return { poblacion: 9840, unidades: 88, nivel:'manzana', viviendas: 2700, censo: 2018,
               etiquetaFuente: 'Censo DANE 2018 · manzana censal',
               tasaAnual: 0.004437, anioProyeccion: 2026,
               fuenteProyeccion: 'DANE · Proyecciones municipales',
               advertenciaProyeccion: 'La tasa es MUNICIPAL.' };
    };
    window.AIA_DATOS.ubicacionDe = async () => ({ ciudad: 'Cúcuta', departamento: 'Norte de Santander' });
  });

  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  // ── La traducción de la Matriz del estudiante ─────────────────────────
  const trad = await pg.evaluate(() => {
    const E = window.URBIS_EDU;
    // puntoAElemento devuelve ahora una LISTA: un edificio puede albergar
    // varios usos y cada uno entra al análisis por separado. Cuando solo hay
    // cabecera (sin matriz marcada) la lista trae un único elemento.
    const de = d => { const els = E.puntoAElemento({ lat:'7.9', lng:'-72.4', descripcion: d }, 1);
      if (!els || !els.length) return null;
      const el = els[0];
      return el.tags['urbis:sub'] || ('via:' + el.tags.highway); };
    return {
      gym:    de('Deportivo · Gimnasio / CrossFit'),
      cancha: de('Deportivo · Cancha sintética'),
      drog:   de('Comercial · Droguería / farmacia'),
      ferre:  de('Comercial · Ferretería / materiales'),
      ropa:   de('Comercial · Ropa / calzado'),
      generico: de('Comercial · Comercio informal fijo (caseta)'),
      plaza:  de('Esp. Público · Plaza / plazoleta'),
      parque: de('Esp. Público · Parque de barrio'),
      uni:    de('Educativo (Básico/Superior) · Universidad'),
      cole:   de('Educativo (Básico/Superior) · Colegio (básica/media)'),
      via:    de('Vías e Infraestructura Vial · Vía principal / arteria'),
      ciclo:  de('Vías e Infraestructura Vial · Ciclorruta'),
      ruina:  de('Abandono / Ruina · Vivienda abandonada'),
      raro:   de('Uso Inventado · Cosa rara'),
      // Todos los usos de la Matriz deben tener traducción.
      sinMapear: (function(){
        const subs = new Set(window.AIA_MOTOR.TAXONOMIA.map(t => t.sub));
        const malos = [];
        Object.keys(E.USO_A_SUB).forEach(u => { if (!subs.has(E.USO_A_SUB[u])) malos.push(u + '→' + E.USO_A_SUB[u]); });
        Object.keys(E.TIPO_A_SUB).forEach(t => { if (!subs.has(E.TIPO_A_SUB[t])) malos.push(t + '→' + E.TIPO_A_SUB[t]); });
        return malos;
      })(),
      nUsos: Object.keys(E.USO_A_SUB).length
    };
  });

  console.log('══ LA TRADUCCIÓN ══════════════════════════════════════════════');
  console.log('  ' + trad.nUsos + ' usos de la Matriz del estudiante traducidos');
  Object.keys(trad).filter(k => k !== 'sinMapear' && k !== 'nUsos')
    .forEach(k => console.log('    ' + k.padEnd(9) + '→ ' + trad[k]));
  chk(trad.sinMapear.length === 0,
      'ninguna traducción apunta a una subcategoría que no existe' +
      (trad.sinMapear.length ? ': ' + trad.sinMapear.slice(0,3).join(', ') : ''));
  chk(trad.nUsos >= 45, 'los 47 usos de la Matriz tienen traducción (' + trad.nUsos + ')');
  // El tipo tiene que mandar sobre el uso, o el análisis no distinguiría una
  // calle de vitrinas de un corredor de materiales.
  chk(trad.gym === 'gimnasio' && trad.cancha === 'deportivo',
      'el tipo afina el uso: gimnasio y cancha no caen en la misma casilla');
  chk(trad.drog === 'drogueria' && trad.ferre === 'ferreteria' && trad.ropa === 'ropa',
      'el comercio se abre en rubros, igual que en el modo empresas');
  chk(trad.plaza === 'plaza' && trad.parque === 'parque',
      'plaza dura y parque verde quedan separados');
  chk(trad.uni === 'universidad' && trad.cole === 'colegio',
      'universidad y colegio se distinguen (mueven flujos distintos)');
  chk(trad.via === 'via:primary' && trad.ciclo === 'via:cycleway',
      'las vías alimentan la malla vial con su jerarquía, no la lista de puntos');
  chk(trad.ruina === 'ruina', 'el deterioro se reconoce');
  chk(trad.raro === null, 'un uso que no existe no se inventa una categoría');

  // ── El análisis completo ──────────────────────────────────────────────
  await pg.evaluate(() => document.getElementById('edu-analisis-btn').click());
  // Qué dijo la pantalla, para que un fallo del análisis se lea acá y no
  // reviente doscientas líneas más abajo con un «null» sin explicación.
  pg.on('console', m => { if (/error|Error/.test(m.text())) console.log('   consola:', m.text().slice(0,120)); });
  await pg.waitForFunction(() => {
    const c = document.getElementById('edu-analisis-salida');
    return c && /edu-kpis|No se pudo|no se pudo/.test(c.innerHTML);
  }, { timeout: 30000 });
  await pg.waitForTimeout(400);

  const r = await pg.evaluate(() => {
    const u = window.URBIS_EDU_UI.ultimo;
    const c = document.getElementById('edu-analisis-salida');
    const capas = Array.from(c.querySelectorAll('.edu-calor')).map(p => {
      const img = p.querySelector('img'), cruz = p.querySelector('.cruz');
      let centrada = false;
      if (img && cruz) {
        const ri = img.getBoundingClientRect(), rc = cruz.getBoundingClientRect();
        centrada = Math.abs((rc.left + rc.width/2) - (ri.left + ri.width/2)) < 1.5 &&
                   Math.abs((rc.top + rc.height/2) - (ri.top + ri.height/2)) < 1.5;
      }
      return { t: p.querySelector('figcaption').textContent.trim(),
               pinta: !!(img && /^data:image\/png/.test(img.getAttribute('src')||'')),
               centrada };
    });
    return {
      salida: (document.getElementById('edu-analisis-salida')||{}).innerHTML ?
              (document.getElementById('edu-analisis-salida').textContent||'').slice(0,200) : '',
      hayUltimo: !!u,
      edu: u && u.edu,
      pob: u && { censo: u.stats.poblacionCenso, proy: u.stats.poblacionProyectada,
                  usada: u.stats.poblacionEstimada, pct: u.stats.crecimientoPct },
      municipio: window.__daneMunicipio,
      flujo: u && { peatonal: u.stats.movilidad.flujo.peatonal,
                    vehicular: u.stats.movilidad.flujo.vehicular,
                    noche: u.stats.movilidad.flujo.franjas.noche,
                    gen: (u.stats.movilidad.flujo.generadores||[]).length,
                    pen: (u.stats.movilidad.flujo.penalizadores||[]).length },
      vias: u && u.stats.movilidad.nViasArterias,
      ciclo: u && u.stats.movilidad.ciclorrutas,
      rubros: u && (u.stats.rubros||[]).slice(0,4).map(x => x.n + '× ' + x.nombre),
      opor: u && (((u.indicadores||{}).oportunidades||{}).lista||[]).length,
      foda: u && ((u.foda.fortalezas||[]).length + (u.foda.debilidades||[]).length +
                  (u.foda.oportunidades||[]).length + (u.foda.riesgos||[]).length),
      capas,
      txt: c.innerText,
      frentesCorregidos: u && u.stats.movilidad.flujo.frentesCorregidos,
      edificacion: u && (u.edu||{}).edificacion,
      // El aviso de sobre-qué-se-analiza tiene que ir ANTES de las cifras.
      posAviso: c.innerHTML.indexOf('edu-base'),
      posKpis: c.innerHTML.indexOf('edu-kpis'),
      hayInforme: !!document.getElementById('edu-analisis-informe')
    };
  });

  console.log('\n── El análisis ────────────────────────────────────────────────');
  if (!r.edu) { console.log('  el análisis no devolvió nada. La pantalla dice:\n   ' + r.salida); process.exit(1); }
  console.log('  puntos del curso en el radio : ' + r.edu.puntosDelCurso +
              ' · leídos por el motor: ' + r.edu.leidos);
  console.log('  sin traducir                 : ' + JSON.stringify(r.edu.sinTraducir));
  console.log('  población  : ' + r.pob.censo + ' → ' + r.pob.proy + ' (+' + r.pob.pct + '%)');
  console.log('  flujo      : peatonal ' + r.flujo.peatonal + ' · vehicular ' + r.flujo.vehicular +
              ' · noche ' + r.flujo.noche);
  console.log('  vías/ciclo : ' + r.vias + ' / ' + r.ciclo);
  console.log('  rubros     : ' + (r.rubros||[]).join(', '));
  console.log('  capas      : ' + r.capas.map(c => c.t + (c.pinta ? '✔' : '✘')).join(' · '));
  console.log('  fachadas corregidas por la visita: ' + r.frentesCorregidos);
  chk(r.frentesCorregidos === 2,
      'la fachada observada en campo llega hasta el informe (' + r.frentesCorregidos + ' bodegas)');
  chk(/la categoría suponía fachada ciega/.test(r.txt),
      'y el informe se lo explica al estudiante: ir a mirar cambió el resultado');
  console.log('  edificación con ficha: ' + (r.edificacion||{}).total +
              ' · evaluables: ' + (r.edificacion||{}).evaluables);
  chk(r.edificacion && r.edificacion.total === 2 && r.edificacion.evaluables === 2,
      'la época del edificio llega al informe por el camino completo');
  chk(/De cuándo es lo construido/.test(r.txt),
      'y el informe trae el bloque de antigüedad del tejido construido');
  chk(/no es un diagnóstico estructural/i.test(r.txt),
      'diciendo con todas las letras que NO es un diagnóstico estructural');

  chk(!!r.edu, 'el análisis se completa y deja resultado');
  chk(r.edu.leidos >= 45 && r.edu.leidos < r.edu.puntosDelCurso,
      'lee los usos del suelo y deja fuera lo que no lo es (' + r.edu.leidos +
      ' de ' + r.edu.puntosDelCurso + ')');
  chk(Object.keys(r.edu.sinTraducir).some(k => /Uso Inventado/.test(k)),
      'y reporta qué etiqueta no supo traducir, en vez de tragársela');

  console.log('\n── Lo que el modo empresas ya tenía, aquí también ─────────────');
  chk(r.municipio === 'Cúcuta',
      'pide el censo con el municipio, para aplicar la tasa correcta');
  chk(r.pob.proy > r.pob.censo && r.pob.usada === r.pob.proy,
      'población del DANE proyectada a hoy (' + r.pob.censo + ' → ' + r.pob.proy + ')');
  chk(/contado/.test(r.txt) && /proyectado/.test(r.txt),
      'y se muestran las dos cifras, la contada y la proyectada');
  chk(r.flujo.peatonal > 0 && r.flujo.gen >= 3,
      'flujo peatonal con sus generadores (' + r.flujo.peatonal + ', ' + r.flujo.gen + ' fuentes)');
  chk(r.flujo.pen >= 2,
      'y lo que resta: la bodega y la ruina descuentan (' + r.flujo.pen + ')');
  chk(r.flujo.noche > 0 && /Noche/.test(r.txt), 'la franja de noche llega al panel');
  chk(r.vias >= 1 && r.ciclo >= 1,
      'las vías del curso alimentan la malla vial (' + r.vias + ' arteria, ' + r.ciclo + ' ciclorruta)');
  chk(r.capas.length === 3 && r.capas.every(c => c.pinta),
      'los tres mapas de calor se pintan');
  chk(r.capas.every(c => c.centrada),
      'con la cruz del punto analizado centrada en cada capa');
  chk((r.rubros || []).length >= 3, 'composición del sector por rubro');
  chk(!(r.rubros || []).some(x => /baldio_obra/.test(x)),
      'sin el alias `baldio_obra`, que no es un uso y salía como fila sin nombre');
  chk(r.opor >= 1, 'oportunidades: qué le podría faltar al sector (' + r.opor + ')');
  chk(r.foda >= 4, 'y la lectura FODA (' + r.foda + ' hallazgos)');
  chk(r.hayInforme, 'se ofrece el informe completo, el mismo de las empresas');

  console.log('\n── Y lo que es propio del modo educativo ──────────────────────');
  chk(r.posAviso >= 0 && r.posAviso < r.posKpis,
      'el aviso de con cuántos puntos se analizó va ANTES de las cifras');
  chk(/mapearon/.test(r.txt),
      'el panel dice que el análisis se hizo con lo que ellos mapearon');
  chk(/NO depende de lo que mapearon/i.test(r.txt),
      'y aclara que la población sí está completa, venga o no de su trabajo');

  // Con pocos puntos, el módulo tiene que decir que es un ejercicio.
  await pg.evaluate(() => {
    window.__eduDatos = window.__eduDatos.slice(0, 6);
    document.getElementById('edu-analisis-btn').click();
  });
  await pg.waitForTimeout(2500);
  const pocos = await pg.evaluate(() => {
    const c = document.getElementById('edu-analisis-salida');
    return { flojo: !!c.querySelector('.edu-base.flojo'), txt: c.innerText };
  });
  console.log('\n  con 6 puntos → aviso de ejercicio: ' + (pocos.flojo ? 'sí' : 'NO'));
  chk(pocos.flojo, 'con pocos puntos el aviso cambia a advertencia');
  chk(/un ejercicio, no un diagn/.test(pocos.txt),
      'y lo dice con todas las letras: es un ejercicio, no un diagnóstico');
  chk(/Mapeen más cuadras/.test(pocos.txt),
      'con la salida concreta: mapear más y volver a analizar');

  const ajenos = errores.filter(e => !/Unexpected end of input/.test(e));
  chk(ajenos.length === 0,
      'el módulo no introduce errores de página' + (ajenos.length ? ': ' + ajenos[0] : ''));

  console.log('\n' + ok.map(t => '✅ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '❌ ' + t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length + fallo.length));
  await b.close();
  server.close();
  process.exit(fallo.length ? 1 : 0);
})();
