const E = require('../entorno.js');
/* Volver a la aplicación después de estar en otra.

   Dicho así: «me salgo de la aplicación, hago algo en otra, y cuando vuelvo
   se resetea todo, o se bugea y me toca reiniciar la app para que vuelva y
   salga mi punto satelital».

   Eran dos cosas y ninguna era que se perdieran los datos:

     · El seguimiento del GPS. Android suspende el `watchPosition` de una
       pestaña en segundo plano y muchas veces no lo devuelve al volver. El
       identificador seguía guardado, y `startMobileGpsWatch` no hace nada si
       ya hay uno, así que nadie volvía a pedirlo: el punto se quedaba
       congelado donde estaba y no había forma de despertarlo sin cerrar y
       abrir la aplicación.

     · El sector analizado. Está archivado y vuelve entero sin red, pero al
       volver el mapa aparece vacío —sin puntos, sin círculo y sin lote— y
       para encontrarlo había que abrir la lupa y buscar una tarjeta adentro.
       Desde afuera eso es indistinguible de haberlo perdido.

   Esta prueba mide las dos con un GPS de mentira que cuenta lo que le piden:
   cuántos seguimientos se abrieron y cuántos se soltaron.                  */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 };

const usos = [];
for (let i = 0; i < 40; i++) {
  const a = i * 9 * Math.PI / 180, d = (140 + (i % 4) * 50) / 111320;
  usos.push({ type: 'node', id: 1000 + i, lat: C.lat + Math.cos(a) * d, lon: C.lng + Math.sin(a) * d,
    tags: { name: 'Establecimiento ' + i, amenity: 'pharmacy' } });
}

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  /* El GPS de mentira. No alcanza con dar permiso y una posición: hace falta
     saber CUÁNTOS seguimientos se abrieron y cuántos se soltaron, que es
     justamente lo que estaba mal. */
  await ctx.addInitScript(() => {
    window.__gps = { abiertos: 0, soltados: 0, precision: 12 };
    const falso = {
      watchPosition(ok) {
        const id = ++window.__gps.abiertos;
        window.__gps.enviar = () => ok({ coords: { latitude: 7.8939, longitude: -72.5078,
          accuracy: window.__gps.precision } });
        setTimeout(window.__gps.enviar, 40);
        return id;
      },
      clearWatch() { window.__gps.soltados++; },
      getCurrentPosition(ok) {
        setTimeout(() => ok({ coords: { latitude: 7.8939, longitude: -72.5078,
          accuracy: window.__gps.precision } }), 30);
      }
    };
    try { Object.defineProperty(navigator, 'geolocation', { get() { return falso; } }); } catch (e) {}
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'martarojas', rol: 'admin',
        es_admin: true, session_token: 't', active: true, verified: true }));
      /* Solo la primera vez: este guion corre en CADA carga, y la prueba
         recarga la página a propósito. Borrando siempre, el sector que se
         acaba de archivar desaparecía en la recarga y la prueba medía otra
         cosa —una aplicación sin nada guardado—. */
      if (!sessionStorage.getItem('__prueba_limpia')) {
        localStorage.removeItem('pcr_fichas_v1'); localStorage.removeItem('aia_overpass_cache_v1');
        sessionStorage.setItem('__prueba_limpia', '1');
      }
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
  await ctx.route(/overpass/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: usos }) }));
  await ctx.route(/ags\.esri\.co/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ features: [{ attributes: { TOTAL: 3045, N: 42 } }] }) }));

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 160)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);
  const r = {};

  // ── Entrar al mapa: un seguimiento abierto y el punto en pantalla.
  r.alEntrar = await pg.evaluate(async () => {
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    const b = document.querySelector('[data-u52-call="procity-open-map"]');
    if (b) { b.click(); await esperar(900); }
    return { abiertos: window.__gps.abiertos, soltados: window.__gps.soltados,
      punto: !!document.querySelector('.u65-gps-avatar-marker') };
  });

  /* ── Irse a otra aplicación y volver ────────────────────────────────────
     Se simula lo que hace el sistema: la pestaña pasa a oculta y vuelve. Es
     el momento exacto en el que Android deja el seguimiento muerto. */
  r.alVolver = await pg.evaluate(async () => {
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    let medido = 0;
    try {
      const antes = window.map.invalidateSize.bind(window.map);
      window.map.invalidateSize = function () { medido++; return antes.apply(this, arguments); };
    } catch (e) {}
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await esperar(300);
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await esperar(800);
    return { abiertos: window.__gps.abiertos, soltados: window.__gps.soltados, medido: medido };
  });

  /* ── Señal mala: el punto no aparece, y hay que decirlo ────────────────
     Bajo techo llegan lecturas con 60, 80, 120 m de error. No sirven para
     mapear y se descartan, pero descartarlas en silencio se ve igual que un
     GPS muerto. */
  r.imprecisa = await pg.evaluate(async () => {
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    // Se borra el punto que ya había para reproducir el arranque bajo techo.
    document.querySelectorAll('.u65-gps-avatar-marker').forEach(x => x.remove());
    window.__gps.precision = 140;
    for (let i = 0; i < 4; i++) { window.__gps.enviar(); await esperar(120); }
    const el = document.querySelector('#u56-mobility-status');
    return { dice: el ? (el.textContent || '').trim() : '' };
  });

  // ── Y el sector: el navegador se lleva la pestaña.
  r.antes = await pg.evaluate(async () => {
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    const R = window.URBIS_PC_RECON;
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    R.abrir(); await esperar(400);
    await R.analizar(); await esperar(1400);
    const caja = document.getElementById('pcr-nombre');
    if (caja) { caja.value = 'El barrio de la prueba'; caja.dispatchEvent(new Event('input', { bubbles: true })); }
    const g = document.getElementById('pcr-hoja').querySelector('[data-pcr="guardar"]');
    if (g) { g.click(); await esperar(700); }
    /* ── El círculo del sector no se va detrás del mapa ────────────────
       Con la hoja bajada para mirar una capa, arrastrar el mapa movía el
       círculo detrás del dedo y lo dejaba a un kilómetro de la foto
       clasificada del propio análisis. Llegó con dos capturas —el recuadro
       de la cobertura arriba y el círculo punteado abajo, sin tocarse— y se
       leyó como «al navegar por el mapa salía este radio de más». Con el
       sector ya analizado, el círculo no es una propuesta: es lo que se
       estudió, y se queda donde se estudió.

       La hoja se baja como se baja de verdad, empujándola desde el asa: es
       el único camino que vuelve a poner el círculo a seguir al mapa. */
    const circulos = () => { const out = [];
      window.map.eachLayer(l => { if (l instanceof L.Circle && l.getRadius)
        out.push({ lat: l.getLatLng().lat, lng: l.getLatLng().lng, r: l.getRadius() }); });
      return out; };
    const asa = document.getElementById('pcr-hoja').querySelector('.pcr-asa');
    if (asa) {
      const c = asa.getBoundingClientRect();
      const x0 = Math.round(c.left + c.width / 2), y0 = Math.round(c.top + c.height / 2);
      const toque = (t, y) => asa.dispatchEvent(new TouchEvent(t, { bubbles: true, cancelable: true,
        touches: t === 'touchend' ? [] : [new Touch({ identifier: 1, target: asa, clientX: x0, clientY: y })],
        changedTouches: [new Touch({ identifier: 1, target: asa, clientX: x0, clientY: y })] }));
      toque('touchstart', y0); await esperar(40);
      for (let i = 1; i <= 6; i++) { toque('touchmove', y0 + i * 20); await esperar(20); }
      toque('touchend', y0 + 120); await esperar(600);
    }
    const bajada = !!document.querySelector('#pcr-hoja.pcr-encogida');
    const antesDeMover = circulos();
    window.map.panTo([7.8939 + 0.012, -72.5078 - 0.010]); await esperar(900);
    const trasMover = circulos();

    R.cerrar(); await esperar(300);
    return { hojaBaja: bajada, circuloAntes: antesDeMover, circuloDespues: trasMover,
      fichas: (R.leerFichas() || []).length,
      volver: (function () { const v = document.getElementById('pcr-volver');
        return v ? { oculto: v.hidden, txt: (v.textContent || '').trim() } : null; })() };
  });

  await pg.reload({ waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);
  r.trasCaerse = await pg.evaluate(async () => {
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    const b = document.querySelector('[data-u52-call="procity-open-map"]');
    if (b) { b.click(); await esperar(900); }
    const v = document.getElementById('pcr-volver');
    const rc = v ? v.getBoundingClientRect() : null;
    return { hay: !!v, oculto: v ? v.hidden : true, txt: v ? (v.textContent || '').trim() : '',
      caja: rc ? Math.round(rc.width) + 'x' + Math.round(rc.height) : '-',
      // El mapa arranca vacío: es lo que hace que parezca que se perdió todo.
      hoja: !!document.querySelector('#pcr-hoja.pcr-visible') };
  });

  // Y tocarlo trae el sector entero, sin abrir nada antes.
  const bv = await pg.$('#pcr-volver');
  try { if (bv) { await bv.tap({ timeout: 4000 }); await pg.waitForTimeout(1600); } }
  catch (e) { console.log('  (no se pudo tocar: ' + String(e.message).slice(0, 90) + ')'); }
  r.trasTocar = await pg.evaluate(() => {
    const R = window.URBIS_PC_RECON, e = R.estado ? R.estado() : {};
    const t = ((document.getElementById('pcr-hoja') || {}).textContent || '');
    return { hay: !!e.hay, forma: e.forma, vertices: e.vertices,
      // Los usos se leen de la ficha en pantalla: es lo que ve quien vuelve.
      usos: (t.match(/(\d+)\s*usos? registrados/) || [])[1] || '0',
      hoja: !!document.querySelector('#pcr-hoja.pcr-visible'),
      texto: t.slice(0, 120) };
  });
  r.err = err;
  await pg.close(); await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

  console.log('\n  -- al entrar al mapa --');
  T('se abre un seguimiento del GPS', (r.alEntrar || {}).abiertos === 1, (r.alEntrar || {}).abiertos + ' seguimientos');
  T('y el punto aparece', (r.alEntrar || {}).punto);

  console.log('\n  -- al volver de otra aplicación --');
  T('se suelta el seguimiento viejo', (r.alVolver || {}).soltados === 1,
    (r.alVolver || {}).soltados + ' soltados');
  T('y se pide uno nuevo, en vez de confiar en el que quedó',
    (r.alVolver || {}).abiertos === 2, (r.alVolver || {}).abiertos + ' seguimientos en total');
  /* El mapa se vuelve a medir: en segundo plano el navegador puede devolver
     la pestaña con otro tamaño y Leaflet sigue creyendo el de antes, así que
     las teselas salen en blanco o corridas hasta que algo lo toca. */
  T('y el mapa se vuelve a medir', (r.alVolver || {}).medido >= 1,
    (r.alVolver || {}).medido + ' veces');

  console.log('\n  -- con señal mala, se dice --');
  T('no se hace pasar por bueno un punto que no sirve',
    /imprecisa|impreciso/i.test((r.imprecisa || {}).dice || ''), (r.imprecisa || {}).dice || '(no dice nada)');
  T('y dice de cuánto es el error', /\d+\s*m/.test((r.imprecisa || {}).dice || ''));

  console.log('\n  -- el círculo del sector no sigue al mapa --');
  const cA = ((r.antes || {}).circuloAntes || [])[0], cB = ((r.antes || {}).circuloDespues || [])[0];
  const met = (a, b) => (a && b) ? Math.round(Math.hypot((a.lat - b.lat) * 110540,
    (a.lng - b.lng) * 111320 * Math.cos(a.lat * Math.PI / 180))) : -1;
  T('la hoja se baja empujándola con el dedo', (r.antes || {}).hojaBaja === true);
  T('y arrastrar el mapa no se lleva el círculo del sector analizado',
    !!cB && met(cA, cB) <= 2, cB ? met(cA, cB) + ' m de desplazamiento' : 'no hay círculo');
  T('ni aparece un segundo círculo',
    ((r.antes || {}).circuloDespues || []).length === 1,
    ((r.antes || {}).circuloDespues || []).length + ' círculos');

  console.log('\n  -- el sector, cuando el navegador se lleva la pestaña --');
  T('quedó archivado antes', (r.antes || {}).fichas === 1);
  T('el mapa arranca vacío, sin la hoja abierta', (r.trasCaerse || {}).hoja === false);
  T('pero el botón de seguir está a la vista, sin abrir nada',
    (r.trasCaerse || {}).hay && (r.trasCaerse || {}).oculto === false,
    (r.trasCaerse || {}).txt || '(no está)');
  T('y dice con qué sector se sigue',
    /El barrio de la prueba/.test((r.trasCaerse || {}).txt || ''), (r.trasCaerse || {}).txt);
  T('tocarlo trae el sector entero, con sus usos',
    (r.trasTocar || {}).hay === true && (r.trasTocar || {}).usos === '40',
    (r.trasTocar || {}).usos + ' usos · ' + (r.trasTocar || {}).forma);
  T('y abre la hoja donde se estaba', (r.trasTocar || {}).hoja === true);

  console.log('');
  T('sin errores de JavaScript', (r.err || []).length === 0, (r.err || []).join(' | ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
