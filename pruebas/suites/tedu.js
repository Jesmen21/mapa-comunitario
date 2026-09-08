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
                       setIcon(){return this;}, setOpacity(){return this;}, setZIndexOffset(){return this;},
                       getTooltip(){ return { getContent: () => this.__tip || '' }; } });
  /* Lo que el calor pone sobre el mapa se graba, porque es lo que la prueba
     mira: qué imagen, con qué límites, y si la anterior se quitó. */
  const grabar = (k, v) => { (window[k] = window[k] || []).push(v); };
  const imageOverlay = (url, bounds, opts) => {
    const c = cap(); c.__url = url; c.__bounds = bounds; c.__opts = opts || {};
    c.getBounds = () => bounds; grabar('__calorCapas', c); return c;
  };
  const circleMarker = (ll, opts) => {
    const c = cap(); c.__ll = ll; c.__opts = opts || {};
    c.bindTooltip = function (t) { this.__tip = t; return this; };
    if (opts && /urb-calor-marca/.test(opts.className || '')) grabar('__calorMarcas', c);
    return c;
  };
  const mapa = () => ({ setView(){return this;}, on(){return this;}, off(){return this;}, once(){return this;},
                        addLayer(){return this;}, removeLayer(l){ grabar('__quitadas', l); return this; }, hasLayer(){return false;},
                        fitBounds(b){ grabar('__encuadres', b); return this; }, invalidateSize(){return this;}, getZoom(){return 16;},
                        getCenter(){return {lat:7.9168,lng:-72.4727};}, getContainer(){return document.body;},
                        eachLayer(){}, getSize(){return {x:360,y:640};}, panTo(){return this;},
                        flyTo(){return this;}, setZoom(){return this;}, addControl(){return this;},
                        removeControl(){return this;}, whenReady(f){ if(f) f(); return this; },
                        // «contains» responde lo que la prueba decida: es la regla del encuadre.
                        getBounds(){return { contains: () => window.__cabeEnPantalla !== false };}, distance(){return 0;}, remove(){return this;},
                        latLngToContainerPoint(){return {x:0,y:0};},
                        containerPointToLatLng(){return {lat:0,lng:0};},
                        getPanes(){return {};}, createPane(){return document.createElement('div');},
                        dragging:{enable(){},disable(){}}, touchZoom:{enable(){},disable(){}},
                        scrollWheelZoom:{enable(){},disable(){}}, doubleClickZoom:{enable(){},disable(){}},
                        boxZoom:{enable(){},disable(){}}, keyboard:{enable(){},disable(){}} });
  const L = { map: mapa, tileLayer: cap, layerGroup: cap, featureGroup: cap, marker: cap,
              circle: cap, circleMarker: circleMarker, imageOverlay: imageOverlay,
              polygon: cap, polyline: cap, rectangle: cap,
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
    /* Solo en el marco principal: ver la nota en las demás suites. La
       aplicación crea un marco escondido para medir la lámina, y sin esta
       guarda ese marco vuelve a ejecutar esto a mitad de la prueba. */
    if (window.top !== window) return;
    try { localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba'); } catch (e) {}
    /* Tres sectores que el curso ya levantó, para que los KPI tengan contra
       qué compararse. Van con cifras deliberadamente bajas: lo que el curso
       analiza en esta prueba tiene que salir por encima de las tres, y así
       la referencia no puede pasar por casualidad. */
    try {
      localStorage.setItem('pcr_fichas_v1', JSON.stringify([1, 2, 3].map(function (i) {
        return { id: 'f' + i, ts: '2026-09-0' + i + 'T12:00:00.000Z', nombre: 'Sector ' + i,
                 stats: { total: i, densidadPorHa: i, poblacionEstimada: i * 10,
                          movilidad: { flujo: { peatonal: i, vehicular: i } } } };
      })));
    } catch (e) {}
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

    /* Las calles del sector, para «¿qué forma tiene la traza?». Se sirve un
       DAMERO de calles cada 100 m, partido cada 50 m como llega de
       OpenStreetMap: así se sabe qué tiene que contestar el motor. La
       clasificación en sí la prueba `tforma` con las cinco formas; acá lo
       que se comprueba es la cadena completa —botón, consulta, motor,
       pantalla— y que lo que se pinta sea lo que el motor devolvió. */
    /* El contexto del sector: lo que OpenStreetMap sabe del sitio y el
       curso no mapeó. Se sirve un sector INVENTADO con todo lo que el lector
       tiene que distinguir: cinco límites del país al barrio, dos barrios
       nombrados, tres paradas, cuatro relaciones de ruta de las que dos son
       la misma ruta (ida y vuelta), un paso de frontera a 1,8 km al oriente
       y otro a 9 km, y dos casas de cambio. Y un elemento sin etiquetas,
       que tiene que pasar de largo. */
    window.__contextoPedido = 0;
    window.__contextoSinFrontera = false;
    window.AIA_DATOS.consultarContexto = async (lat, lng, radioM) => {
      window.__contextoPedido++;
      const GLAT = m => m / 110540, GLNG = m => m / (111320 * Math.cos(lat * Math.PI / 180));
      const N = (id, tags, dx, dy) => ({ type: 'node', id, lat: lat + GLAT(dy), lon: lng + GLNG(dx), tags });
      const R = (id, tags) => ({ type: 'relation', id, tags });
      const els = [
        R(1, { boundary: 'administrative', admin_level: '10', name: 'Barrio La Playa' }),
        R(2, { boundary: 'administrative', admin_level: '2', name: 'Colombia' }),
        R(3, { boundary: 'administrative', admin_level: '6', name: 'Cúcuta' }),
        R(4, { boundary: 'administrative', admin_level: '4', name: 'Norte de Santander' }),
        R(5, { boundary: 'administrative', admin_level: '9', name: 'Comuna 1' }),
        N(11, { place: 'neighbourhood', name: 'El Callejón' }, 300, 300),
        N(12, { place: 'neighbourhood', name: 'La Playa' }, -120, 60),
        N(21, { highway: 'bus_stop', name: 'Parada Diagonal' }, 80, 0),
        N(22, { highway: 'bus_stop' }, -200, 150),
        N(23, { highway: 'bus_stop' }, 40, -300),
        R(31, { type: 'route', route: 'bus', ref: '7', name: 'Ruta 7: Centro → Atalaya', operator: 'Cootranscúcuta', colour: '#e5484d' }),
        R(32, { type: 'route', route: 'bus', ref: '7', name: 'Ruta 7: Atalaya → Centro', operator: 'Cootranscúcuta', colour: '#e5484d' }),
        R(33, { type: 'route', route: 'bus', ref: '12', name: 'Ruta 12: Centro → Aeropuerto' }),
        R(34, { type: 'route', route: 'share_taxi', name: 'Colectivo La Parada' }),
        N(51, { amenity: 'bureau_de_change', name: 'Cambios El Puente' }, 150, -40),
        N(52, { amenity: 'money_transfer', name: 'Giros Ya' }, -60, 220),
        { type: 'node', id: 99, lat: lat, lon: lng }
      ];
      if (!window.__contextoSinFrontera) {
        els.push(N(41, { barrier: 'border_control', name: 'Puente Internacional Simón Bolívar' }, 1800, 0));
        els.push(N(42, { barrier: 'border_control', name: 'Puente Francisco de Paula Santander' }, 3000, 8500));
      }
      return els;
    };

    window.__viasPedidas = 0;
    window.AIA_DATOS.consultarVias = async (lat, lng, radioM) => {
      window.__viasPedidas++;
      const GLAT = m => m / 110540, GLNG = m => m / (111320 * Math.cos(lat * Math.PI / 180));
      const P = (dx, dy) => ({ lat: lat + GLAT(dy), lng: lng + GLNG(dx) });
      const partir = (a, b) => { const out = [];
        for (let k = 0; k <= 24; k++) out.push({ lat: a.lat + (b.lat - a.lat) * k / 24,
                                                 lng: a.lng + (b.lng - a.lng) * k / 24 });
        return out; };
      const els = []; let id = 1;
      for (let i = -6; i <= 6; i++) {
        els.push({ type:'way', id:id++, tags:{ highway:'residential', name:'Calle ' + i },
                   geometry: partir(P(-600, i*100), P(600, i*100)) });
        els.push({ type:'way', id:id++, tags:{ highway:'residential', name:'Carrera ' + i },
                   geometry: partir(P(i*100, -600), P(i*100, 600)) });
      }
      return els;
    };
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
      const img = p.querySelector('img'), cruz = p.querySelector('.urb-calor-centro');
      let centrada = false;
      if (img && cruz) {
        const ri = img.getBoundingClientRect(), rc = cruz.getBoundingClientRect();
        centrada = Math.abs((rc.left + rc.width/2) - (ri.left + ri.width/2)) < 1.5 &&
                   Math.abs((rc.top + rc.height/2) - (ri.top + ri.height/2)) < 1.5;
      }
      // A la defensiva: contra el panel anterior no hay foco ni `data-capa`,
      // y una suite que revienta no reporta, solo se cae.
      const foco = p.querySelector('.urb-calor-foco');
      return { t: (p.querySelector('figcaption').firstChild || {}).textContent || '',
               pinta: !!(img && /^data:image\/png/.test(img.getAttribute('src')||'')),
               centrada, capa: p.getAttribute('data-capa') || '',
               foco: foco ? { left: foco.style.left, top: foco.style.top } : null };
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
      /* El calor sobre el mapa del curso, apenas termina el análisis. */
      calor: (function () {
        const mc = u && u.stats.movilidad && u.stats.movilidad.flujo && u.stats.movilidad.flujo.mapaCalor;
        const K = window.URBIS_CALOR, ctl = (window.URBIS_EDU_UI || {}).calor;
        const puestas = window.__calorCapas || [], ultima = puestas[puestas.length - 1];
        const marcas = window.__calorMarcas || [], marca = marcas[marcas.length - 1];
        const centro = map.getCenter();
        return {
          hayModulo: !!K, n: mc ? mc.n : 0, radioM: mc ? mc.radioM : 0,
          focoDia: mc && mc.focoDia ? { i: mc.focoDia.i, j: mc.focoDia.j, texto: mc.focoDia.texto } : null,
          puestas: puestas.length, activa: ctl ? ctl.activa : '',
          url: ultima ? String(ultima.__url).slice(0, 15) : '',
          limites: ultima ? ultima.__bounds : null,
          limitesModulo: (K && mc) ? K.limites(mc) : null,
          centroMapa: { lat: centro.lat, lng: centro.lng },
          encuadres: (window.__encuadres || []).length,
          tip: marca ? marca.__tip : '',
          botonAct: (c.querySelector('.urb-calor-botones button.act') || {}).textContent || '',
          quitarVisible: !!(c.querySelector('.urb-calor-botones .quitar') && !c.querySelector('.urb-calor-botones .quitar').hidden),
          leyendas: c.querySelectorAll('.urb-calor-leyenda i').length
        };
      })(),
      txt: c.innerText,
      frentesCorregidos: u && u.stats.movilidad.flujo.frentesCorregidos,
      edificacion: u && (u.edu||{}).edificacion,
      // El aviso de sobre-qué-se-analiza tiene que ir ANTES de las cifras.
      posAviso: c.innerHTML.indexOf('edu-base'),
      posKpis: c.innerHTML.indexOf('edu-kpis'),
      hayInforme: !!document.getElementById('edu-analisis-informe'),
      // Los anillos y la referencia de los KPI, desde la v802.
      refs: Array.from(c.querySelectorAll('.edu-kpi')).map(k => ({
        etq: (k.querySelector('span') || {}).textContent || '',
        ref: (k.querySelector('.urb-ref em') || {}).textContent || ''
      })),
      anillos: {
        minis: Array.from(c.querySelectorAll('.urb-anillo-mini')).map(f =>
          ((f.querySelector('figcaption') || {}).textContent || '') + ' → ' +
          ((f.querySelector('.urb-anillo-forma') || {}).textContent || '')),
        trazos: c.querySelectorAll('.urb-anillo-chispa path').length,
        filas: c.querySelectorAll('.edu-tbl-radios tr').length,
        actual: c.querySelectorAll('.edu-tbl-radios tr.act').length
      },
      // Los anillos que devolvió el motor, para cotejar contra lo pintado.
      nAnillos: u && u.multiRadio ? (u.multiRadio.anillos || []).length : 0,
      // Que el censo por anillo llegó: sin `danePorRadio` los anillos caen a
      // la heurística y el KPI de habitantes contradice la tabla.
      pobPorAnillo: u && u.multiRadio
        ? (u.multiRadio.anillos || []).map(a => a.poblacionEstimada) : []
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

  /* ── El calor sobre el mapa (v807) ───────────────────────────────────
     Hasta la v806 el calor eran tres cuadritos en el panel: se veía DÓNDE
     dentro del cuadrado, no sobre qué calle. Ahora la capa se pone sobre
     el mapa del curso, en el sitio exacto que mide. */
  console.log('\n── El calor sobre el mapa ────────────────────────────────────');
  const K = r.calor;
  console.log('  capas puestas: ' + K.puestas + ' · activa: ' + K.activa + ' · límites: ' + JSON.stringify(K.limites));
  chk(K.hayModulo, 'el módulo compartido del calor (js/56) está cargado en la página del curso');
  chk(r.capas.map(c => c.capa).join(',') === 'dia,noche,vehiculo',
      'cada miniatura sabe qué capa es y se puede tocar');
  // Se compara como número: el navegador devuelve «75%» donde se escribió «75.0%».
  const fd = K.focoDia, f0 = r.capas[0].foco;
  chk(!!(fd && f0 && Math.abs(parseFloat(f0.left) - (fd.i + .5) / K.n * 100) < 0.1 &&
                     Math.abs(parseFloat(f0.top) - (fd.j + .5) / K.n * 100) < 0.1),
      'y marca el punto más activo en la celda que dijo el motor (' + JSON.stringify(f0) + ')');
  chk(K.puestas === 1 && K.activa === 'dia' && /^data:image\/png/.test(K.url),
      'al terminar el análisis, la capa de día queda puesta sobre el mapa sin pedirla');
  // El cuadrado que cubre la malla: lado 2·radio, centrado en el punto analizado.
  const lim = K.limites;
  const ladoNS = lim ? Math.round((lim[1][0] - lim[0][0]) * 110540) : 0;
  const ladoEO = lim ? Math.round((lim[1][1] - lim[0][1]) * 111320 * Math.cos(K.centroMapa.lat * Math.PI / 180)) : 0;
  const centrado = lim && Math.abs((lim[0][0] + lim[1][0]) / 2 - K.centroMapa.lat) < 1e-7 &&
                          Math.abs((lim[0][1] + lim[1][1]) / 2 - K.centroMapa.lng) < 1e-7;
  chk(ladoNS === 2 * K.radioM && ladoEO === 2 * K.radioM,
      'la capa cubre exactamente el cuadrado que mide la malla: ' + ladoNS + ' × ' + ladoEO + ' m para un radio de ' + K.radioM);
  chk(!!centrado, 'centrado en el punto que analizaron');
  chk(JSON.stringify(lim) === JSON.stringify(K.limitesModulo),
      'y son los límites que calcula el módulo, no otros');
  chk(K.encuadres === 0, 'sin mover el mapa al terminar cuando el cuadrado cabe en pantalla: el estudiante lo puso donde lo quería');
  // La otra mitad de la regla: si NO cabe —se analizó muy de cerca— sí encuadra.
  const encuadraSiNoCabe = await pg.evaluate(() => {
    const antes = (window.__encuadres || []).length;
    window.__cabeEnPantalla = false;
    try { window.URBIS_EDU_UI.mostrarCalor('dia'); } catch (e) {}
    window.__cabeEnPantalla = true;
    return (window.__encuadres || []).length - antes;
  });
  chk(encuadraSiNoCabe === 1, 'pero si el cuadrado del calor no cabe en pantalla, sí lo encuadra');
  chk(!!(fd && K.tip && K.tip.indexOf(fd.texto) >= 0),
      'el punto más activo va sobre el mapa con su frase (' + K.tip + ')');
  chk(/día/.test(K.botonAct) && K.quitarVisible, 'el botón de la capa puesta se ve marcado y aparece «Quitar»');
  chk(K.leyendas === 2, 'con la leyenda de las dos rampas, a pie y en vehículo');

  // Cambiar de capa reemplaza, no apila; quitar deja el mapa limpio.
  const cambio = await pg.evaluate(() => {
    const c = document.getElementById('edu-analisis-salida');
    // A la defensiva: contra el panel anterior no hay botones ni controlador,
    // y una suite que revienta no reporta, solo se cae.
    const toca = sel => { const el = c.querySelector(sel); if (el) el.click(); return !!el; };
    const activa = () => ((window.URBIS_EDU_UI || {}).calor || {}).activa || '';
    const antes = (window.__calorCapas || []).length, antesEnc = (window.__encuadres || []).length;
    toca('.urb-calor-botones button[data-capa="vehiculo"]');
    const capas = window.__calorCapas || [], quitadas = window.__quitadas || [];
    const veh = { puestas: capas.length - antes, activa: activa(),
                  quitoAnterior: quitadas.indexOf(capas[antes - 1]) >= 0,
                  encuadro: (window.__encuadres || []).length - antesEnc,
                  act: Array.from(c.querySelectorAll('[data-capa].act')).map(e => e.getAttribute('data-capa')) };
    toca('.urb-calor-botones .quitar');
    const q = c.querySelector('.urb-calor-botones .quitar');
    const fuera = { activa: activa(),
                    quitoVeh: (window.__quitadas || []).indexOf(capas[capas.length - 1]) >= 0,
                    act: c.querySelectorAll('[data-capa].act').length,
                    quitarVisible: !!(q && !q.hidden) };
    // Tocar la miniatura también la pone. El número se toma ANTES del toque:
    // `capas` es el mismo arreglo que el stub va llenando.
    const antesNoche = capas.length;
    toca('figure[data-capa="noche"]');
    const noche = { activa: activa(), puestas: (window.__calorCapas || []).length - antesNoche };
    return { veh, fuera, noche };
  });
  chk(cambio.veh.puestas === 1 && cambio.veh.activa === 'vehiculo' && cambio.veh.quitoAnterior,
      'cambiar a «En vehículo» reemplaza la capa de día, no la apila');
  chk(cambio.veh.encuadro === 1, 'y al pedirla a mano sí encuadra el mapa en el sector');
  chk(cambio.veh.act.length === 2 && cambio.veh.act.every(a => a === 'vehiculo'),
      'miniatura y botón marcan la misma capa puesta');
  chk(cambio.fuera.activa === '' && cambio.fuera.quitoVeh && cambio.fuera.act === 0 && !cambio.fuera.quitarVisible,
      '«Quitar» limpia el mapa y el panel, y se esconde');
  chk(cambio.noche.activa === 'noche' && cambio.noche.puestas === 1,
      'tocar la miniatura de la noche la pone sobre el mapa');
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

  // ── El entorno según la distancia (v802) ──────────────────────────────
  // El motor ya devolvía estos anillos en el modo educativo desde siempre;
  // simplemente nadie los pintaba. Para un curso es de las lecturas más
  // útiles: dice si el sitio que mapearon es un núcleo o un borde, y eso
  // caminando no se ve.
  console.log('\n── El entorno según la distancia ───────────────────────────────');
  console.log('  anillos del motor: ' + r.nAnillos + ' · habitantes por anillo: ' + r.pobPorAnillo.join(' / '));
  r.anillos.minis.forEach(m => console.log('  ' + m));
  chk(r.nAnillos >= 2, 'el motor devuelve el sector medido en varios anillos (' + r.nAnillos + ')');
  chk(r.anillos.minis.length === 4,
      'y el panel del curso los dibuja, uno por métrica (' + r.anillos.minis.length + ')');
  chk(r.anillos.trazos >= 8, 'cada gráfico con su área y su línea (' + r.anillos.trazos + ' trazos)');
  chk(r.anillos.filas === r.nAnillos + 1,
      'la tabla con los números exactos va debajo (' + r.anillos.filas + ' filas)');
  chk(r.anillos.actual === 1, 'con el radio analizado marcado, y solo uno');
  chk(r.anillos.minis.every(m => /baja al alejarse|sube al alejarse|se mantiene/.test(m)),
      'y cada uno dice en palabras qué forma tiene, que es lo que se lee en un teléfono');
  // El censo por anillo: si `danePorRadio` no llegara, los anillos caerían a
  // la estimación heurística y la tabla contradiría el KPI de habitantes.
  chk(r.pobPorAnillo.length >= 2 && r.pobPorAnillo.every(v => typeof v === 'number' && v >= 0),
      'cada anillo trae su población, no un hueco (' + r.pobPorAnillo.join('/') + ')');

  // ── Un número con su referencia (v802) ────────────────────────────────
  console.log('\n── Los KPI y su referencia ────────────────────────────────────');
  r.refs.forEach(k => console.log('  ' + k.etq + (k.ref ? '   → ' + k.ref : '   (sin referencia)')));
  const refDe = t => (r.refs.find(k => k.etq.indexOf(t) === 0) || {}).ref;
  chk(r.refs.length === 4, 'los cuatro KPI del curso siguen ahí (' + r.refs.length + ')');
  chk(['Habitantes', 'Flujo a pie', 'Flujo vehicular', 'Usos leídos']
        .every(t => /de 3$|de tus /.test(refDe(t) || '')),
      'los cuatro se comparan contra los sectores que el curso ya levantó');
  // Las tres fichas sembradas llevan cifras mínimas a propósito: si la
  // referencia comparara contra otra cosa —o no comparara— esto no saldría.
  chk(refDe('Habitantes') === 'el más alto de tus 4',
      'y la comparación es de verdad, no un texto fijo (' + refDe('Habitantes') + ')');

  // ── ¿Qué forma tiene la traza? (v803) ─────────────────────────────────
  // Lo pedía el profesor con la infografía de morfología urbana en la mano.
  // Va a botón y no automático: Overpass no acepta dos consultas seguidas, y
  // esto NO depende de lo que el curso haya mapeado.
  const hayBoton = await pg.evaluate(() => !!document.getElementById('edu-forma-btn'));
  chk(hayBoton, 'el análisis ofrece reconocer la forma de la traza, a botón');
  chk(await pg.evaluate(() => window.__viasPedidas === 0),
      'y no baja las calles hasta que se lo piden');

  if (hayBoton) {
    await pg.evaluate(() => document.getElementById('edu-forma-btn').click());
    await pg.waitForFunction(() => {
      const c = document.getElementById('edu-forma');
      return c && !document.getElementById('edu-forma-btn');
    }, { timeout: 25000 }).catch(() => {});
    const fm = await pg.evaluate(() => {
      const c = document.getElementById('edu-forma') || document.createElement('div');
      return {
        nombre: (c.querySelector('.edu-forma-cabeza b') || {}).textContent || '',
        sub: (c.querySelector('.edu-forma-cabeza small') || {}).textContent || '',
        porque: (c.querySelector('.edu-forma-porque') || {}).textContent || '',
        ojo: (c.querySelector('.edu-forma-ojo') || {}).textContent || '',
        txt: c.innerText,
        pedidas: window.__viasPedidas
      };
    });
    console.log('\n── La forma de la traza ───────────────────────────────────────');
    console.log('  ' + fm.nombre + '  ·  ' + fm.sub);
    console.log('  ' + fm.porque);
    chk(fm.pedidas === 1, 'al tocarlo baja las calles una sola vez (' + fm.pedidas + ')');
    chk(fm.nombre === 'Ortogonal',
        'y reconoce el damero que se le sirvió (' + fm.nombre + ')');
    chk(/26 calles/.test(fm.sub),
        'diciendo sobre cuántas calles lo dice (' + fm.sub + ')');
    chk(/orden|direcciones/.test(fm.porque) && fm.porque.length > 25,
        'con la medida que lo decidió y no solo la etiqueta');
    chk(/dentro del radio analizado/.test(fm.ojo),
        'y con la advertencia de que describe el radio, no la ciudad');
    // La frase que evita que un curso salga a caminar creyendo que va a
    // cambiar esta etiqueta.
    chk(/no de lo que ustedes mapearon|no cambia si mapean más/.test(fm.txt),
        'dice que esta lectura no depende de lo que el curso mapeó');

  /* ── El sector en su contexto (v808) ──────────────────────────────────
     Comuna y barrio, busetas y frontera: lo que el levantamiento del curso
     no puede dar. A botón, como la forma, y por su propia consulta. */
  console.log('\n── El sector en su contexto ──────────────────────────────────');
  const ctxAntes = await pg.evaluate(() => ({
    boton: !!document.getElementById('edu-contexto-btn'),
    pedidos: window.__contextoPedido,
    // A la defensiva: contra el panel anterior no existe ni la tarjeta.
    caja: !!document.getElementById('edu-contexto')
  }));
  chk(ctxAntes.caja && ctxAntes.boton, 'el análisis ofrece consultar el contexto del sector, a botón');
  chk(ctxAntes.pedidos === 0, 'y no lo consulta hasta que se lo piden');
  const CX = await pg.evaluate(async () => {
    const b = document.getElementById('edu-contexto-btn');
    if (!b) return { sinBoton: true };
    b.click();
    await new Promise(r => setTimeout(r, 300));
    const caja = document.getElementById('edu-contexto');
    const u = window.URBIS_EDU_UI.ultimo || {};
    const c = u.contexto || {};
    return {
      pedidos: window.__contextoPedido,
      txt: caja.innerText,
      migas: Array.from(caja.querySelectorAll('.edu-migas span')).map(e => e.lastChild.textContent),
      rutas: Array.from(caja.querySelectorAll('.edu-rutas li')).map(li => ((li.querySelector('b') || {}).textContent || '') + '|' + ((li.querySelector('span') || {}).textContent || '')),
      colores: Array.from(caja.querySelectorAll('.edu-rutas li i')).map(i => i.style.background),
      grado: (caja.querySelector('.edu-bina') || { className: '' }).className,
      paso: c.paso, cambio: (c.cambio || []).length, paradas: c.paradas, barrios: c.barrios,
      enUltimo: !!u.contexto
    };
  });
  console.log('  migas: ' + (CX.migas || []).join(' › '));
  console.log('  rutas: ' + (CX.rutas || []).join(' · '));
  console.log('  frontera: ' + JSON.stringify(CX.paso));
  chk(CX.pedidos === 1, 'al tocarlo consulta una sola vez (' + CX.pedidos + ')');
  chk((CX.migas || []).join('›') === 'Colombia›Norte de Santander›Cúcuta›Comuna 1›Barrio La Playa',
      'los límites salen ordenados del país al barrio, no como llegaron');
  chk(!!(CX.barrios && CX.barrios.length === 2 && CX.barrios[0].nombre === 'La Playa'),
      'los barrios nombrados cerca, del más cercano al más lejano');
  chk((CX.rutas || []).length === 3 && CX.rutas[0] === '7|Ruta 7: Centro → Atalaya',
      'las rutas: ida y vuelta de la 7 son UNA ruta, y quedan tres (' + (CX.rutas || []).length + ')');
  chk(!!(CX.colores && /229, 72, 77/.test(CX.colores[0])), 'con el color de la ruta cuando lo trae');
  chk(CX.paradas === 3 && /3 rutas.*3 paradas/.test(CX.txt), 'y dice en cuántas paradas recogen (' + CX.paradas + ')');
  chk(/no la oferta completa/.test(CX.txt), 'aclarando que es lo subido al mapa, no la oferta real');
  chk(!!(CX.paso && CX.paso.distM >= 1795 && CX.paso.distM <= 1805 && /Simón Bolívar/.test(CX.paso.nombre)),
      'el paso de frontera más cercano, con su distancia (' + (CX.paso || {}).distM + ' m)');
  chk(/edu-bina-fuerte/.test(CX.grado) && /1,8 km hacia el oriente/.test(CX.txt),
      'a 1,8 km la frontera se lee como rasgo fuerte del sector, con rumbo');
  chk(CX.cambio === 2 && /2 casas de cambio o giros/.test(CX.txt),
      'las casas de cambio y giros del radio se cuentan y confirman la lectura (' + CX.cambio + ')');
  chk(/Otros pasos: Puente Francisco de Paula Santander/.test(CX.txt), 'y nombra el otro paso, más lejos');
  chk(/no de lo que mapearon/.test(CX.txt), 'dice que esto sale de OpenStreetMap y no de su levantamiento');
  chk(CX.enUltimo, 'y queda en el resultado, para que el informe lo lleve');

  // Sin frontera cerca: la lectura tiene que cambiar de grado, no callarse.
  const SIN = await pg.evaluate(async () => {
    // A la defensiva: contra el módulo anterior no existe `contexto`.
    if (!window.URBIS_EDU || !window.URBIS_EDU.contexto) return { grado: '', lectura: '', html: '' };
    window.__contextoSinFrontera = true;
    const c = await window.URBIS_EDU.contexto({ lat: 7.9168, lng: -72.4727 }, 500);
    const html = window.URBIS_EDU_UI.bloqueContexto(c);
    window.__contextoSinFrontera = false;
    return { grado: c.binacional.grado, lectura: c.binacional.lectura, html };
  });
  chk(SIN.grado === 'ninguno' && /no es un rasgo de este sector/.test(SIN.lectura),
      'sin paso a menos de 15 km, dice que lo binacional no es un rasgo del sector');
  chk(/edu-bina-ninguno/.test(SIN.html) && !/Para leer el flujo binacional/.test(SIN.html),
      'y no manda a contar casas de cambio donde no hay frontera que las explique');

  }

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
