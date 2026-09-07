const E = require('../entorno.js');
/* Una sola carga, y cada fila en su cajón.

   La hoja trae en una sola tabla los reportes Y lo que no es un reporte:
   comentarios, avatares, la vitrina, las peticiones al administrador, las
   ubicaciones, las relaciones. La carga los reparte en cajones y deja en el
   mapa solo los reportes; cada módulo lee su cajón.

   Eso llevaba tiempo sin pasar y nada lo decía. La portada SUSTITUÍA la
   carga por una copia suya —para poder actualizar sus métricas— y esa copia
   se había quedado sin el reparto: con ella al mando, la vitrina y los
   avatares se leían siempre vacíos, el buzón de peticiones del panel de
   administración también, y `globalData` cargaba con filas que no se
   pintan. En pantalla no se veía: el mapa salía igual, porque los reportes
   sí estaban.

   Lo que se comprueba, con una fila de cada clase:

     · que cada cajón reciba la suya y el mapa se quede solo con el reporte;
     · que `urbisPermisos` siga siendo la FUNCIÓN que dice qué puede hacer
       quien está usando la aplicación —el reparto tenía una fila con ese
       mismo nombre y se la habría comido—;
     · y que las métricas de la portada, que son la razón por la que existía
       la copia, sigan actualizándose después de cargar.                    */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO;
const LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 };
const ahora = new Date().toISOString();

/* Una fila de cada clase. El tipo se reconoce por su TEXTO sin tildes ni
   emoji —el Sheet los devuelve descompuestos—, así que van con emoji y con
   acento a propósito. */
const META = [
  { tipo: '💬 Comentario', lat: '7.8940', lng: '-72.5079', descripcion: 'c | hola vecino |', fecha: ahora },
  { tipo: '🧑 Avatar', lat: '7.8941', lng: 'quiensea', descripcion: 'skin7', fecha: ahora },
  { tipo: '📨 Petición', lat: '7.8942', lng: '-72.5080', descripcion: 'pet | quiero ser JAC |', fecha: ahora },
  { tipo: '🏪 Emprendimiento', lat: '7.8943', lng: '-72.5081', descripcion: 'e | Tienda La Playa |', fecha: ahora },
  { tipo: '📍 Ubicación', lat: '7.8944', lng: '-72.5082', descripcion: 'u | mi casa |', fecha: ahora },
  { tipo: '🔑 Permiso', lat: '7.8945', lng: '-72.5083', descripcion: 'perm | publicar |', fecha: ahora }
];

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'vecina', rol: 'citizen',
        session_token: 't', active: true, verified: true }));
      localStorage.removeItem('urbis_db_cache_v1');
    } catch (e) {}
  });
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: fs.readFileSync(S + 'node_modules/chart.js/dist/chart.umd.js', 'utf8') }));
  await ctx.route(/basemaps\.cartocdn\.com|arcgisonline\.com|maptiles\.arcgis\.com|mt\d\.google\.com\/vt/,
    r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
  await ctx.route(/script\.google\.com/, r => {
    const cuerpo = r.request().postData() || '';
    if (/db_read/.test(cuerpo) || !cuerpo) {
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: (globalThis.__DATOS || []) }) });
    }
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' });
  });

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  // Un reporte de verdad, armado con las casillas que espera la aplicación.
  const reporte = await pg.evaluate((D) => {
    const base = (typeof BASE_OFFSET === 'number') ? BASE_OFFSET
               : (6 + ((typeof todosLosUsos !== 'undefined' && todosLosUsos.length) || 0));
    const d = [];
    for (let i = 0; i < base + 10; i++) d.push('');
    d[0] = 'Hueco en la vía'; d[1] = 'Calle 9 con avenida 3'; d[2] = 'Hueco grande'; d[3] = 'Malo';
    d[base] = 'N/A'; d[base + 1] = 'Aprobado'; d[base + 2] = 'Vecina'; d[base + 3] = 'citizen'; d[base + 4] = '1';
    return { tipo: '🚨 Alertas y Riesgos Urbanos', lat: String(D.C.lat), lng: String(D.C.lng),
             descripcion: d.join(' | '), fecha: D.ahora };
  }, { C, ahora });
  globalThis.__DATOS = [reporte].concat(META);

  await pg.evaluate(() => { try { localStorage.removeItem('urbis_db_cache_v1'); } catch (e) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r = await pg.evaluate(async (D) => {
    const { C } = D, o = {}, esperar = ms => new Promise(x => setTimeout(x, ms));
    window.map.setView([C.lat, C.lng], 16); await esperar(300);
    if (typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos();
    await esperar(2500);

    const cuantas = v => Array.isArray(v) ? v.length : -1;
    o.globalData = (typeof globalData !== 'undefined' && globalData) ? globalData.length : -1;
    o.tiposEnMapa = (typeof globalData !== 'undefined' && globalData || []).map(p => String(p.tipo || ''));
    o.cajones = {
      comentarios: cuantas(window.urbisComentarios),
      avatares: cuantas(window.urbisAvatares),
      peticiones: cuantas(window.urbisPeticiones),
      vitrina: cuantas(window.urbisVitrina),
      ubicaciones: cuantas(window.urbisUbicaciones),
      permisosFilas: cuantas(window.urbisPermisosFilas)
    };
    // El avatar se guarda normalizado: { lng: usuario, descripcion: avatarId }.
    o.avatar = (window.urbisAvatares || [])[0] || null;
    /* Y el nombre que se disputaban: `urbisPermisos` es la función que dice
       qué puede hacer quien usa la aplicación. Si el reparto se lo comiera,
       seis sitios llamarían a un array. */
    o.permisos = typeof window.urbisPermisos;
    o.permisosResponde = (function () {
      try { return Array.isArray(window.urbisPermisos()); } catch (e) { return 'ERROR ' + e.message; }
    })();
    /* Las métricas de la portada, que son la razón de ser de la copia: las
       tarjetas `[data-landing-metric]` y los tres números pequeños. */
    o.metricas = [...document.querySelectorAll('[data-landing-metric]')]
      .map(x => (x.getAttribute('data-landing-metric') || '') + ':' +
                ((x.querySelector('strong') || {}).textContent || '').trim());
    o.mini = ['total', 'process', 'review'].map(k => {
      const el = document.querySelector('[data-landing-metric-' + k + ']');
      return k + ':' + (el ? (el.textContent || '').trim() : '—');
    });
    o.visibles = (window.urbisDatosVisibles && window.urbisDatosVisibles() || []).length;
    return o;
  }, { C });

  await pg.close(); await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };
  const cj = r.cajones || {};

  console.log('\n  -- el mapa se queda solo con los reportes --');
  T('de siete filas, una sola llega al mapa', r.globalData === 1 && r.visibles === 1,
    r.globalData + ' en globalData · ' + r.visibles + ' visible(s) · ' + (r.tiposEnMapa || []).join(', '));
  T('y es el reporte, no una fila de servicio',
    (r.tiposEnMapa || []).length === 1 && /Alertas y Riesgos/.test((r.tiposEnMapa || [])[0] || ''),
    (r.tiposEnMapa || []).join(', '));

  console.log('\n  -- cada fila, en su cajón --');
  T('el comentario, en el de comentarios', cj.comentarios === 1, String(cj.comentarios));
  T('la petición, en el buzón del administrador', cj.peticiones === 1, String(cj.peticiones));
  T('el negocio, en la vitrina', cj.vitrina === 1, String(cj.vitrina));
  T('la ubicación, en el suyo', cj.ubicaciones === 1, String(cj.ubicaciones));
  T('y el avatar, normalizado a usuario y figura',
    cj.avatares === 1 && !!r.avatar && r.avatar.lng === 'quiensea' && r.avatar.descripcion === 'skin7',
    JSON.stringify(r.avatar));

  console.log('\n  -- el nombre que se disputaban --');
  /* La fila de permisos va a `urbisPermisosFilas`. El nombre corto es de la
     función de js/13h, y asignarle un array la habría borrado: no se notaba
     porque el reparto llevaba tiempo sin ejecutarse. */
  T('la fila de permisos tiene su propio cajón', cj.permisosFilas === 1, String(cj.permisosFilas));
  T('y urbisPermisos sigue siendo la función que responde qué puede hacer uno',
    r.permisos === 'function' && r.permisosResponde === true,
    r.permisos + ' · devuelve lista: ' + r.permisosResponde);

  console.log('\n  -- y la portada sigue contando --');
  /* La copia existía para esto. Al delegar en la carga de siempre, las
     métricas se encadenan al final: si se hubieran perdido, la primera
     pantalla mostraría ceros. */
  T('las tarjetas de la portada se llenaron con lo cargado',
    (r.metricas || []).length > 0 && (r.metricas || []).some(x => /:\s*[1-9]/.test(x)),
    (r.metricas || []).join(' · ') || 'sin tarjetas');
  T('y el contador total cuenta el reporte',
    (r.mini || []).some(x => /^total:\s*1$/.test(x)), (r.mini || []).join(' · '));

  console.log('');
  const errFin = err.filter(e => !/L is not defined|Unexpected end/.test(e));
  T('sin errores de JavaScript', errFin.length === 0, errFin.slice(0, 2).join(' | ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
