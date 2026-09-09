const E = require('../entorno.js');
/* PEDIR CORRECCIÓN: DECIRLE A LA PERSONA QUÉ ARREGLAR (v835)
   ────────────────────────────────────────────────────────────────────────
   Es la otra mitad de lo que se pidió junto al portero de la foto: «esa
   cédula, si es falsa, pues se le dice a la persona que la cédula es falsa
   o que la corrija».

   Hasta acá el moderador solo tenía dos botones, y ninguno servía para eso:
     · APROBAR publica la foto de alguien cuya cédula no se pudo verificar;
     · ELIMINAR borra el reporte sin decirle por qué. Esa persona no se
       entera de nada y la próxima vez lo manda igual.
   Faltaba la puerta del medio.

   Tres cosas que esta suite defiende, y las tres se pueden romper sin que
   se note mirando la pantalla:

   1. Pedir una corrección NO PUBLICA. El reporte sigue Pendiente. Es lo
      contrario de aprobar: es decir «esto todavía no».
   2. El mensaje llega. Vive en la fila del reporte y no en un chat, porque
      de quien reporta se guarda su NOMBRE, no necesariamente su usuario, y
      un mensaje directo no siempre llegaría — y un aviso que a veces no
      llega es peor que ninguno, porque el moderador cree que ya avisó.
      Así que se comprueba que aparece donde la persona lo va a ver: en
      «Mis reportes» y en el detalle de su propio reporte.
   3. Escribir la petición no toca NADA MÁS de la fila. Es el mismo cuidado
      que con aprobar: una petición que de paso borrara la nota del
      ciudadano sería peor que no pedir nada.                             */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const LEAFLET = (E.TRABAJO || '') + 'node_modules/leaflet/dist/';
  await ctx.route('**/leaflet*.js', r => r.fulfill({ contentType: 'application/javascript',
    body: fs.readFileSync(LEAFLET + 'leaflet.js', 'utf8') }));
  await ctx.route('**/leaflet*.css', r => r.fulfill({ contentType: 'text/css',
    body: fs.readFileSync(LEAFLET + 'leaflet.css', 'utf8') }));
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const AUTOR = 'Marta Rios';
  const NOTA = 'El hueco lleva semanas y ya se cayo una moto.';
  const PETICION = 'No pudimos verificar tu cedula. Revisa el numero en tu cuenta.';

  const SLOTS = await pg.evaluate(() => (window.URBIS_SLOTS ? {
    correccion: window.URBIS_SLOTS.correccionPedida, base: window.BASE_OFFSET || null
  } : null));
  chk(!!(SLOTS && SLOTS.correccion > 0),
      'la casilla de la petición está en el mapa único de posiciones, no calculada aparte');

  const BASE = await pg.evaluate(() => { try { return BASE_OFFSET; } catch (e) { return 43; } });
  /* Contra la versión anterior esa casilla todavía no existe. Se calcula la
     que le tocaría —el final de la tabla— para poder armar la fila igual y
     que la suite REPORTE qué falta, en vez de reventar armando un array de
     longitud indefinida. */
  const SLOT_CORR = (SLOTS && SLOTS.correccion > 0) ? SLOTS.correccion : (BASE + 8 + 16);

  const fila = (extra) => pg.evaluate(([base, autor, nota, slot, corr]) => {
    const d = new Array(slot + 2).fill('');
    d[0] = 'Hueco en la via'; d[1] = 'Hueco frente al colegio'; d[2] = nota; d[3] = 'Malo';
    d[base] = 'https://ejemplo.local/prueba.jpg';
    d[base + 1] = 'Pendiente';
    d[base + 2] = autor; d[base + 3] = 'citizen'; d[base + 4] = '0'; d[base + 7] = 'La Floresta';
    if (corr) d[slot] = corr;
    return d.join(' | ');
  }, [BASE, AUTOR, NOTA, SLOT_CORR, extra || '']);

  const punto = async (corr) => ({ lat: 6.2518, lng: -75.5636, tipo: '🚨 Alertas y Riesgos Urbanos', descripcion: await fila(corr) });

  // ── 1. Escribir y volver a leer ────────────────────────────────────────
  const ida = await pg.evaluate(async ([desc, texto]) => {
    if (typeof window.urbisEscribirCorreccion !== 'function' || typeof window.urbisLeerCorreccion !== 'function') return null;
    const p = { lat: 1, lng: 1, tipo: 'x', descripcion: desc };
    const nueva = window.urbisEscribirCorreccion(p, texto);
    const leida = window.urbisLeerCorreccion({ descripcion: nueva });
    return { nueva, texto: leida.texto, pedida: leida.pedida, hayFecha: !!leida.fecha };
  }, [(await punto()).descripcion, PETICION]);
  chk(!!ida && ida.pedida && ida.texto === PETICION, 'lo que escribe el moderador se vuelve a leer igual');
  chk(!!ida && ida.hayFecha, 'y queda con su fecha: sin ella, nadie sabe si se pidió hoy o hace un mes');

  // ── 2. Pedir NO publica, y no toca nada más de la fila ────────────────
  if (ida) {
    const antes = (await punto()).descripcion.split(' | ');
    const desp = ida.nueva.split(' | ');
    chk(desp[BASE + 1] === 'Pendiente',
        'pedir una corrección NO publica el reporte: sigue pendiente, que es justo lo que significa');
    const tocadas = desp.map((v, i) => (v === antes[i] ? null : i))
                        .filter(i => i !== null && i !== SLOT_CORR);
    chk(tocadas.length === 0,
        'y no se movió ninguna otra casilla de la fila' + (tocadas.length ? ' (se movieron: ' + tocadas.join(', ') + ')' : ''));
    chk(desp[2] === NOTA, 'la nota que escribió el ciudadano sigue entera');
  }

  // ── 3. La barra y los ~~~ no rompen la fila ────────────────────────────
  /* La barra separa las casillas de la fila y `~~~` separa fecha de texto
     dentro de esta. Un moderador escribiendo «revisa | la cédula» partiría
     el registro en dos y correría todos los campos siguientes. */
  const sucio = await pg.evaluate(([desc]) => {
    if (typeof window.urbisEscribirCorreccion !== 'function') return { campos: -1, leido: '(no existe)' };
    const nueva = window.urbisEscribirCorreccion({ descripcion: desc }, 'revisa | la cedula ~~~ ya');
    return { campos: nueva.split(' | ').length, leido: window.urbisLeerCorreccion({ descripcion: nueva }).texto };
  }, [(await punto()).descripcion]);
  const camposEsperados = (await punto()).descripcion.split(' | ').length;
  chk(sucio.campos === camposEsperados,
      'una petición con barras no parte la fila en dos (' + sucio.campos + ' campos, se esperaban ' + camposEsperados + ')');
  chk(sucio.campos > 0 && !/\|/.test(sucio.leido) && !/~~~/.test(sucio.leido),
      'los separadores se cambian por guiones, como ya se hace con la nota del ciudadano');

  // ── 4. Una fila sin petición no inventa ninguna ────────────────────────
  const limpia = await pg.evaluate(([desc]) => (typeof window.urbisLeerCorreccion === 'function')
    ? window.urbisLeerCorreccion({ descripcion: desc }).pedida : null, [(await punto()).descripcion]);
  chk(limpia === false, 'un reporte al que nadie le pidió nada no enseña una petición fantasma');

  // ── 5. El autor la ve en el detalle de su reporte ─────────────────────
  await pg.evaluate(() => {
    window.__authReal = window.URBIS_AUTH;
    window.__ponerRol = function (rol, nombre) {
      window.userRole = rol === 'admin' ? 'admin' : (rol || 'citizen');
      window.userNameGlobal = nombre || ''; window.userUsernameGlobal = nombre || '';
      window.userEmailGlobal = ''; window.userCedulaGlobal = '';
      document.body.dataset.role = window.userRole;
      window.URBIS_AUTH = (rol === 'admin')
        ? Object.assign({}, window.__authReal, { readSession: () => ({ usuario: 'mod', rol: 'admin', es_admin: true }) })
        : Object.assign({}, window.__authReal, { readSession: () => ({}) });
    };
  });
  const conRol = (rol, nombre) => pg.evaluate(([r, n]) => window.__ponerRol(r, n), [rol, nombre || '']);

  const conPeticion = await punto(new Date().toISOString() + '~~~' + PETICION);
  const detalle = (p) => pg.evaluate(q => {
    try { (window.mostrarDetalles || mostrarDetalles)(q); } catch (e) { return null; }
    const c = document.getElementById('info-content');
    return c ? c.textContent : null;
  }, p);

  await conRol('citizen', AUTOR);
  const dMio = await detalle(conPeticion);
  chk(dMio !== null && /Te piden corregir/.test(dMio) && dMio.indexOf('cedula') !== -1,
      'el autor ve en su reporte qué le piden corregir');

  await conRol('citizen', 'Otra Persona');
  const dAjeno = await detalle(conPeticion);
  chk(dAjeno !== null && !/Te piden corregir/.test(dAjeno),
      'y un vecino cualquiera NO: lo que un moderador le pide a alguien no es asunto del barrio');

  await conRol('admin', 'Moderadora');
  const dMod = await detalle(conPeticion);
  chk(dMod !== null && /Te piden corregir/.test(dMod),
      'el moderador sí la ve: le hace falta para saber si ya se pidió');

  /* ── El defecto que se escapó en la v835 ──────────────────────────────
     La petición se seguía enseñando DESPUÉS de aprobar el reporte. Y como
     un reporte aprobado lo ve cualquiera, el barrio entero leía lo que un
     moderador le había dicho a una persona: «revisa tu cédula». Dos cosas
     mal a la vez —decir algo falso, porque ya está publicado, y airear una
     conversación privada—.

     Se escapó porque la suite de la v835 probaba el reporte PENDIENTE, que
     es el estado para el que estaba diseñado, y no el de después. De ahí
     estas tres líneas: el mismo reporte, ya aprobado, mirado por los tres.
     Un aviso hay que probarlo también en el estado en el que tiene que
     CALLARSE. */
  const yaAprobado = { lat: 6.2518, lng: -75.5636, tipo: '🚨 Alertas y Riesgos Urbanos',
                       descripcion: conPeticion.descripcion.split(' | ')
                         .map((v, i) => (i === BASE + 1 ? 'Aprobado' : v)).join(' | ') };
  await conRol('citizen', 'Otra Persona');
  const apVecino = await detalle(yaAprobado);
  chk(apVecino !== null && !/Te piden corregir/.test(apVecino),
      'aprobado el reporte, un vecino NO lee lo que el moderador le pidió a su autor');
  await conRol('citizen', AUTOR);
  const apAutor = await detalle(yaAprobado);
  chk(apAutor !== null && !/Te piden corregir/.test(apAutor),
      'y su propio autor tampoco: ya se publicó, no le están pidiendo nada');
  await conRol('admin', 'Moderadora');
  const apMod = await detalle(yaAprobado);
  chk(apMod !== null && !/Te piden corregir/.test(apMod),
      'ni el moderador en la ficha pública: lo que ya se pidió lo ve en su bandeja, no encima del reporte');
  /* Y la regla vive en UN sitio. Repartida por las pantallas, una se queda
     sin ella —fue exactamente lo que pasó— y esa es la que enseña de más. */
  const j05 = fs.readFileSync(REPO + '/js/05-helpers-temporal-security.js', 'utf8');
  chk(/vigente:\s*!publicado/.test(j05),
      'quién puede ver la petición lo decide el lector, no cada pantalla por su cuenta');

  // ── 6. Y en «Mis reportes», que es donde la va a encontrar ────────────
  const enMisReportes = await pg.evaluate(async (q) => {
    if (typeof window.urbisRenderMisReportes !== 'function') return null;
    const antes = globalData.slice();
    globalData.length = 0; globalData.push(q);
    window.__ponerRol('citizen', 'Marta Rios');
    if (window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function') window.UrbisMobileAppV58.show('timeline');
    window.urbisRenderMisReportes();
    await new Promise(r => setTimeout(r, 300));
    const c = document.getElementById('u52-timeline-content');
    const caja = c ? c.querySelector('.mis-rep-pedido') : null;
    const tarjeta = c ? c.querySelector('.mis-rep-card') : null;
    const res = {
      hay: !!caja,
      texto: caja ? caja.textContent : '',
      marcada: !!(tarjeta && tarjeta.classList.contains('mis-rep-con-pedido')),
      visible: !!(caja && getComputedStyle(caja).display !== 'none'),
      // Tiene que ir ARRIBA de los botones: si queda debajo, en una lista de
      // diez reportes nadie la ve.
      antesDeLosBotones: !!(caja && tarjeta && tarjeta.firstElementChild === caja)
    };
    globalData.length = 0; antes.forEach(x => globalData.push(x));
    return res;
  }, conPeticion);
  chk(!!(enMisReportes && enMisReportes.hay && enMisReportes.visible),
      'en «Mis reportes» la petición se ve, que es donde la persona la va a encontrar');
  chk(!!(enMisReportes && /cedula/.test(enMisReportes.texto) && /Corregir ahora/.test(enMisReportes.texto)),
      'con lo que se le pide y un botón para arreglarlo ahí mismo');
  chk(!!(enMisReportes && enMisReportes.antesDeLosBotones),
      'y va arriba de la tarjeta: entre diez reportes, el que espera algo de mí tiene que distinguirse antes de leerlo');
  chk(!!(enMisReportes && enMisReportes.marcada),
      'la tarjeta entera queda marcada');

  // ── 7. El botón está en la bandeja del moderador ──────────────────────
  const j13g = fs.readFileSync(REPO + '/js/13g-config-admin.js', 'utf8');
  chk(/data-acc="corregir"/.test(j13g), 'la bandeja de aprobar ofrece pedir corrección');
  chk(/urbisEscribirCorreccion/.test(j13g), 'y la guarda por el mismo sitio que la lee todo el resto');
  /* Que la acción NO toque la casilla de aprobación es lo que garantiza que
     pedir no publique. Se lee el bloque entero de esa acción. */
  const bloque = (j13g.match(/if \(acc === 'corregir'\)[\s\S]*?\n      \}/) || [''])[0];
  chk(bloque.length > 100, 'se encuentra el bloque de la acción');
  // Atada a que el bloque EXISTA: sobre un bloque vacío, «no escribe en la
  // casilla de aprobación» es cierto y no ha mirado nada.
  chk(bloque.length > 100 && !/base \+ 1\]\s*=/.test(bloque) && !/'Aprobado'/.test(bloque),
      'y esa acción no escribe en la casilla de aprobación: pedir no publica');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
