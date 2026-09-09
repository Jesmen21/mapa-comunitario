const E = require('../entorno.js');
/* EL RANKING DEL EVENTO NO SE ABRE EN BLANCO (v830)
   ────────────────────────────────────────────────────────────────────────
   Se entraba a un Juegos URBIS y el podio salía vacío —«Libre / Libre /
   Libre», «1 jugador»— aunque uno ya hubiera jugado y supiera que había
   más gente. Se dijo así: «se siente muy extraño entrar al evento y que
   todo esté vacío, aunque ya haya jugado».

   No se perdía nada: el módulo se abría con la tabla en cero y esperaba a
   que contestara el servidor. Con señal regular son dos segundos de podio
   vacío; sin señal, se queda vacío para siempre y sin decir por qué,
   porque el fallo se tragaba en silencio. Para quien juega por dinero, un
   ranking vacío no se lee como «está cargando», se lee como «me borraron
   los puntos».

   Ahora se abre con la última tabla vista y se reemplaza cuando llega la
   del servidor. Lo que esta suite defiende, además de eso:

   · UNA sola caché. El módulo del premio (js/13j) ya guardaba este mismo
     ranking; si el hub se hubiera hecho la suya, dos pantallas de la misma
     aplicación enseñarían dos rankings distintos del mismo evento, y en un
     evento con dinero de por medio eso parece trampa.
   · Lo guardado se enseña ETIQUETADO. Un ranking de ayer presentado como
     recién llegado hace que alguien crea que ese es su puesto de ahora.
   · Un evento TERMINADO no proclama ganador desde la caché. Todo lo demás
     de esa pantalla admite estar un poco viejo; el nombre de quien cobra,
     no. La caché vive en `localStorage`, que cualquiera edita a mano.
   · Y un podio vacío mientras se carga no puede decir «aún no hay
     jugadores»: eso es una afirmación, y mientras se carga es falsa.     */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 820 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  const LEAFLET = (E.TRABAJO || '') + 'node_modules/leaflet/dist/';
  await pg.route('**/leaflet*.js', r => r.fulfill({ contentType: 'application/javascript',
    body: fs.readFileSync(LEAFLET + 'leaflet.js', 'utf8') }));
  await pg.route('**/leaflet*.css', r => r.fulfill({ contentType: 'text/css',
    body: fs.readFileSync(LEAFLET + 'leaflet.css', 'utf8') }));
  await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const JUEGO = 'aurea_9999999_r2';

  /* El servidor del evento, sustituido. La red de esta caja no llega al
     backend, así que sin esto solo se podría medir el camino del fallo — y
     hace falta medir los dos, porque la diferencia entre ellos es
     justamente lo que decide si se proclama un ganador. */
  await pg.evaluate(() => {
    window.__authReal = window.URBIS_AUTH;
    window.__servidor = { modo: 'ok', tabla: [] };
    window.URBIS_AUTH = Object.assign({}, window.__authReal, {
      readSession: () => ({ usuario: 'ana', rol: 'citizen', session_token: 't' }),
      socialAPI: (p) => {
        if (p && p.action === 'leaderboard') {
          if (window.__servidor.modo === 'falla') return Promise.reject(new Error('sin red'));
          return Promise.resolve({ ok: true, tabla: window.__servidor.tabla });
        }
        return Promise.resolve({ ok: true });
      }
    });
    window.urbisUsuarioActual = () => 'ana';
    // Un contenedor con el id que usa el módulo, para poder leer lo pintado.
    if (!document.getElementById('u52-aurea-content')) {
      const d = document.createElement('div');
      d.id = 'u52-aurea-content';
      document.body.appendChild(d);
    }
  });

  const limpiar = () => pg.evaluate(j => {
    try { localStorage.removeItem('urbis_premio_lb_' + j); } catch (e) {}
    try { localStorage.removeItem('urbis_best_' + j); } catch (e) {}
    window.__urbisAureaTabla = null;
    window.__urbisAureaTablaEstado = null;
    window.__urbisAureaTablaCuando = 0;
  }, JUEGO);

  // ── 1. La caché compartida existe y va y viene ─────────────────────────
  chk(await pg.evaluate(() => typeof window.urbisTablaEventoLeer === 'function' &&
                              typeof window.urbisTablaEventoGuardar === 'function'),
      'hay un solo par de funciones para leer y guardar la tabla del evento');

  await limpiar();
  const vuelta = await pg.evaluate(j => {
    if (typeof window.urbisTablaEventoGuardar !== 'function') return null;
    window.urbisTablaEventoGuardar(j, [{ usuario: 'ana', puntos: 3102 }, { usuario: 'beto', puntos: 2800 }]);
    const g = window.urbisTablaEventoLeer(j);
    let crudo = null;
    try { crudo = JSON.parse(localStorage.getItem('urbis_premio_lb_' + j) || 'null'); } catch (e) {}
    return { g: g, tieneT: !!(crudo && crudo.t), tieneTabla: !!(crudo && Array.isArray(crudo.tabla)) };
  }, JUEGO);
  chk(!!(vuelta && vuelta.g && vuelta.g.tabla.length === 2 && vuelta.g.cuando > 0),
      'lo guardado se vuelve a leer, con la hora en que se vio');
  chk(!!(vuelta && vuelta.tieneT && vuelta.tieneTabla),
      'y se guarda con la MISMA forma {t, tabla} y la misma llave que ya usaba el módulo del premio');

  // ── 2. Abrir el evento no lo abre en blanco ────────────────────────────
  const abierto = await pg.evaluate(j => {
    /* Devuelve un vacío en vez de reventar cuando la pieza aún no existe:
       así esta suite se puede correr contra la versión anterior y LEER qué
       falta, en vez de recibir una excepción que no dice nada. */
    if (typeof window.urbisTablaEventoGuardar !== 'function') return { filas: -1, estado: '(no existe)', cuando: 0 };
    window.urbisTablaEventoGuardar(j, [{ usuario: 'ana', puntos: 3102 }, { usuario: 'beto', puntos: 2800 }]);
    window.__urbisAureaTabla = null; window.__urbisAureaTablaEstado = null;
    // Sin navegar: se mira lo que deja preparado el abridor.
    const showReal = window.UrbisMobileAppV58 && window.UrbisMobileAppV58.show;
    if (window.UrbisMobileAppV58) window.UrbisMobileAppV58.show = () => {};
    window.urbisAbrirAureaModulo(j, 'Evento URBIS (Polo)', '50.000', '1/11/2026', false);
    if (window.UrbisMobileAppV58 && showReal) window.UrbisMobileAppV58.show = showReal;
    return {
      filas: (window.__urbisAureaTabla || []).length,
      estado: window.__urbisAureaTablaEstado,
      cuando: window.__urbisAureaTablaCuando
    };
  }, JUEGO);
  chk(abierto.filas === 2,
      'al abrir el evento la tabla YA trae los jugadores que se vieron la última vez (' + abierto.filas + ')');
  chk(abierto.estado === 'guardada' && abierto.cuando > 0,
      'y queda marcada como guardada, con su hora: no se hace pasar por recién traída');

  // ── 3. Lo pintado en el primer instante, que es lo que se reclamó ──────
  // Se lee el DOM ANTES de que conteste el servidor: ese primer fotograma
  // es exactamente lo que la persona vio vacío.
  const primerCuadro = await pg.evaluate(() => {
    // Se siembra la casilla a mano, con la forma que ya usaba el módulo del
    // premio: así la versión vieja tiene DISPONIBLE lo último visto y lo
    // que se mide es si lo usa, no si existe.
    try { localStorage.setItem('urbis_premio_lb_aurea_9999999_r2', JSON.stringify({ t: Date.now(), tabla: [{ usuario: 'ana', puntos: 3102 }, { usuario: 'beto', puntos: 2800 }] })); } catch (e) {}
    window.__urbisAureaCtx = { juegoId: 'aurea_9999999_r2', titulo: 'Evento URBIS (Polo)', premio: '50.000', fin: '1/11/2026', terminado: false };
    window.__urbisAureaTabla = null; window.__urbisAureaTablaEstado = null;
    window.__servidor.modo = 'lento';
    window.urbisRenderAureaHub();
    const c = document.getElementById('u52-aurea-content');
    return {
      html: c ? c.innerHTML : '',
      usuarios: [...c.querySelectorAll('.am-pod-user')].map(x => x.textContent.trim()),
      chips: [...c.querySelectorAll('.ah-chip')].map(x => x.textContent.trim())
    };
  });
  chk(primerCuadro.usuarios.filter(u => u === 'Libre').length === 1,
      'el podio se abre con los dos jugadores puestos y un solo lugar «Libre», no tres');
  chk(primerCuadro.usuarios.includes('@ana') && primerCuadro.usuarios.includes('@beto'),
      'y con los nombres de quienes jugaron (' + primerCuadro.usuarios.join(', ') + ')');
  chk(primerCuadro.chips.some(c => /2 jugadores/.test(c)),
      'la cuenta de jugadores abre en 2, no en 1: no parpadea de «1 jugador» a «2 jugadores»');
  chk(primerCuadro.chips.some(c => /Visto/.test(c) && /actualizando/.test(c)),
      'y se dice que eso es lo último visto y que se está actualizando');

  // ── 4. Cuando contesta el servidor, manda el servidor ──────────────────
  const fresca = await pg.evaluate(async () => {
    window.__servidor.modo = 'ok';
    window.__servidor.tabla = [{ usuario: 'beto', puntos: 4100 }, { usuario: 'ana', puntos: 3102 }, { usuario: 'caro', puntos: 900 }];
    window.urbisRenderAureaHub();
    await new Promise(r => setTimeout(r, 250));
    const c = document.getElementById('u52-aurea-content');
    let guardado = null;
    try { guardado = JSON.parse(localStorage.getItem('urbis_premio_lb_aurea_9999999_r2') || 'null'); } catch (e) {}
    return {
      usuarios: [...c.querySelectorAll('.am-pod-user')].map(x => x.textContent.trim()),
      chips: [...c.querySelectorAll('.ah-chip')].map(x => x.textContent.trim()),
      estado: window.__urbisAureaTablaEstado,
      guardadas: guardado && Array.isArray(guardado.tabla) ? guardado.tabla.length : 0
    };
  });
  chk(fresca.estado === 'fresca' && fresca.usuarios[1] === '@beto',
      'la tabla del servidor reemplaza a la guardada (ahora manda @beto)');
  chk(!fresca.chips.some(c => /Visto/.test(c)),
      'y la etiqueta de «visto hace rato» desaparece: ya no es lo guardado, es lo de ahora');
  chk(fresca.guardadas === 3,
      'lo que trajo el servidor queda guardado para la próxima vez (' + fresca.guardadas + ' filas)');

  // ── 5. Sin señal: se conserva lo que había y se dice ───────────────────
  const caido = await pg.evaluate(async () => {
    window.__servidor.modo = 'falla';
    window.__urbisAureaTablaEstado = null;
    window.urbisRenderAureaHub();
    await new Promise(r => setTimeout(r, 250));
    const c = document.getElementById('u52-aurea-content');
    return {
      usuarios: [...c.querySelectorAll('.am-pod-user')].map(x => x.textContent.trim()),
      chips: [...c.querySelectorAll('.ah-chip')].map(x => x.textContent.trim()),
      estado: window.__urbisAureaTablaEstado
    };
  });
  chk(caido.estado === 'sinred' && caido.usuarios.includes('@beto'),
      'si la red falla, el ranking que había NO se borra');
  chk(caido.chips.some(c => /sin conexión/i.test(c)),
      'y se dice que está sin conexión, en vez de callarse y dejar un podio raro');

  // ── 6. Sin nada guardado, «cargando» no puede decir «no hay nadie» ─────
  const vacio = await pg.evaluate(() => {
    try { localStorage.removeItem('urbis_premio_lb_aurea_8888888_r2'); } catch (e) {}
    try { localStorage.removeItem('urbis_best_aurea_8888888_r2'); } catch (e) {}
    window.urbisUsuarioActual = () => '';
    window.__servidor.modo = 'lento';
    window.__urbisAureaCtx = { juegoId: 'aurea_8888888_r2', titulo: 'Otro', premio: '10.000', fin: '', terminado: false };
    window.__urbisAureaTabla = []; window.__urbisAureaTablaEstado = 'cargando';
    window.urbisRenderAureaHub();
    const t = document.getElementById('u52-aurea-content').textContent;
    window.urbisUsuarioActual = () => 'ana';
    return t;
  });
  chk(/Trayendo el ranking/.test(vacio),
      'un evento aún sin datos dice que está trayendo el ranking');
  chk(!/Aún no hay jugadores/.test(vacio),
      'y NO afirma «aún no hay jugadores» mientras carga: eso sería decir algo que no se sabe');

  // ── 7. Un evento terminado no proclama ganador de memoria ─────────────
  const terminadoGuardado = await pg.evaluate(() => {
    window.__servidor.modo = 'lento';
    window.__urbisAureaCtx = { juegoId: 'aurea_9999999_r2', titulo: 'Evento URBIS (Polo)', premio: '50.000', fin: '1/11/2026', terminado: true };
    let g = null;
    if (typeof window.urbisTablaEventoLeer === 'function') g = window.urbisTablaEventoLeer('aurea_9999999_r2');
    else { try { const c = JSON.parse(localStorage.getItem('urbis_premio_lb_aurea_9999999_r2') || 'null'); if (c) g = { tabla: c.tabla, cuando: c.t }; } catch (e) {} }
    window.__urbisAureaTabla = g ? g.tabla : [];
    window.__urbisAureaTablaEstado = 'guardada';
    window.__urbisAureaTablaCuando = g ? g.cuando : 0;
    window.urbisRenderAureaHub();
    return document.getElementById('u52-aurea-content').textContent;
  });
  chk(!/Ganador:/.test(terminadoGuardado),
      'un evento terminado NO nombra ganador desde lo guardado en el teléfono');
  chk(/Confirmando el resultado/.test(terminadoGuardado),
      'dice que está confirmando el resultado con el servidor');

  const terminadoFresco = await pg.evaluate(async () => {
    window.__servidor.modo = 'ok';
    window.__urbisAureaTablaEstado = null;
    window.urbisRenderAureaHub();
    await new Promise(r => setTimeout(r, 250));
    return document.getElementById('u52-aurea-content').textContent;
  });
  chk(/Ganador:/.test(terminadoFresco) && /@beto/.test(terminadoFresco),
      'y sí lo nombra en cuanto el servidor confirma quién ganó');

  const terminadoCaido = await pg.evaluate(async () => {
    window.__servidor.modo = 'falla';
    window.__urbisAureaTablaEstado = null;
    window.urbisRenderAureaHub();
    await new Promise(r => setTimeout(r, 250));
    return document.getElementById('u52-aurea-content').textContent;
  });
  chk(!/Ganador:/.test(terminadoCaido) && /no se pudo confirmar/i.test(terminadoCaido),
      'sin señal tampoco lo nombra: dice que hay que volver a entrar con señal');

  // ── 8. Una sola caché, no dos ──────────────────────────────────────────
  const j12 = fs.readFileSync(REPO + '/js/12-spa-ui.js', 'utf8');
  const j13j = fs.readFileSync(REPO + '/js/13j-premio.js', 'utf8');
  /* Se cuenta dónde se ESCRIBE la llave. Que js/13j la nombre está bien —es
     su respaldo si js/12 no cargó—; lo que no puede haber es un segundo
     `setItem` que guarde por su cuenta con otra forma o en otro momento. */
  const escribe12 = (j12.match(/setItem\(_AUREA_LB_K/g) || []).length;
  chk(escribe12 === 1,
      'js/12 guarda la tabla del evento en un solo sitio (' + escribe12 + ')');
  /* Y se comprueba de verdad, no solo leyendo el código: después de traer
     la tabla, el ranking de este evento tiene que estar guardado en UNA
     casilla, no en dos. Una segunda casilla es exactamente cómo se llega a
     que dos pantallas enseñen rankings distintos. */
  const casillas = await pg.evaluate(j => {
    const con = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.indexOf(j) === -1) continue;
      let v = null;
      try { v = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) {}
      if (v && Array.isArray(v.tabla)) con.push(k);
    }
    return con;
  }, JUEGO);
  chk(casillas.length === 1,
      'y en el navegador queda UNA sola casilla con el ranking de este evento (' + (casillas.join(', ') || 'ninguna') + ')');
  chk(/urbisTablaEventoGuardar/.test(j13j) && /urbisTablaEventoLeer/.test(j13j),
      'y el módulo del premio usa esas mismas funciones en vez de llevar su propia caché');
  chk(/urbis_premio_lb_/.test(j12) && /K_LB = 'urbis_premio_lb_'/.test(j13j),
      'las dos pantallas miran la misma llave: dos rankings distintos del mismo evento parecerían trampa');

  // La corrección de un puntaje por el administrador tiene que invalidar lo
  // guardado; si no, la tabla corregida seguiría viéndose mal al reabrir.
  chk(/removeItem\('urbis_premio_lb_' \+ juegoId\)/.test(j12),
      'corregir un puntaje borra la tabla guardada: una corrección que no se ve no corrigió nada');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
