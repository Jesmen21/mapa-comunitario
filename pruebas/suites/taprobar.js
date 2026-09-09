const E = require('../entorno.js');
/* LA FOTO ESPERA APROBACIÓN, Y SE APRUEBA DESDE EL MAPA (v829)
   ────────────────────────────────────────────────────────────────────────
   Tres cosas que se pidieron juntas porque son la misma pantalla:

   1. Un reporte se publica en cuanto se envía; su FOTO no. La foto es lo
      que puede arruinar a alguien —una cara, una placa, la puerta de una
      casa— y una vez está en el mapa ya la vio el barrio. Espera a que un
      moderador la mire y a que compruebe que quien la subió se registró
      con una cédula real.
   2. Aprobar desde el globo del marcador, con el mapa detrás. Antes había
      que abrir el panel de configuración: justo donde no se ve DÓNDE está
      el reporte, que es la mitad del criterio para aprobarlo.
   3. Un sello encima del marcador pendiente, para el moderador: su cola de
      trabajo, vista desde el mapa, sin abrir globo por globo.

   Cómo se mide, y por qué así:

   · El portero y el globo se ejercitan CONTRA LA APLICACIÓN DE VERDAD
     (`window.urbisFotoDeReporte` y `window.urbisCrearMarcadorUrbano`), no
     contra una copia del código. Una prueba que reimplementa lo que
     comprueba solo demuestra que la copia coincide consigo misma.
   · Lo que se ve y lo que no se ve se mide con `getComputedStyle` sobre la
     página completa, con `css/main.css` entero. Es la lección de la v824:
     una prueba de estilo que carga UNA hoja comprueba una intención, no la
     cascada — trece botones se quedaron en blanco meses con la prueba en
     verde porque otra hoja los apagaba desde más abajo.
   · Y se comprueba que el icono del marcador SIGUE en `position:absolute`.
     Ese fue el error que casi se sube: poner `position:relative` en el
     icono para colgarle el sello lo despega de su coordenada y mueve
     todos los marcadores pendientes de sitio.                            */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  // ── Dónde cae cada casilla de la fila ──────────────────────────────────
  // Se cuenta de la fuente, no se escribe a mano: la lista de usos crece, y
  // un 43 escrito acá se quedaría viejo sin que nadie se enterara.
  const j04 = fs.readFileSync(REPO + '/js/04-marker-proximity.js', 'utf8');
  chk(/const BASE_OFFSET = 6 \+ todosLosUsos\.length;/.test(j04),
      'la casilla base sigue siendo 6 + los usos (si esto cambia, esta suite mide otra cosa)');
  const contarUsos = re => {
    const m = j04.match(re);
    return m ? (m[1].match(/"/g) || []).length / 2 : 0;
  };
  const BASE = 6 + contarUsos(/const usosBase = \[([\s\S]*?)\];/) + contarUsos(/const usosExtra = \[([\s\S]*?)\];/);
  chk(BASE > 20, 'se pudo contar la casilla base de la fila (' + BASE + ')');

  // Una fila de reporte armada a mano, con las casillas que importan.
  const fila = (o) => {
    const d = new Array(BASE + 8).fill('');
    d[0] = 'Hueco en la vía';
    d[1] = 'Hueco grande frente al colegio';
    d[2] = 'Lleva semanas y ya se cayó una moto.';
    d[3] = 'Malo';
    d[BASE] = o.foto === undefined ? 'https://ejemplo.local/prueba.jpg' : o.foto;
    d[BASE + 1] = o.estado === undefined ? 'Aprobado' : o.estado;
    d[BASE + 2] = o.autor || 'Anónimo';
    d[BASE + 3] = 'citizen';
    d[BASE + 4] = '0';
    return d.join(' | ');
  };
  const punto = (o) => ({
    lat: o.lat || 6.2518, lng: -75.5636,
    tipo: '🚨 Alertas y Riesgos Urbanos',
    descripcion: fila(o)
  });

  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 780 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  /* Leaflet se sirve del disco: la red de esta caja no llega al CDN, y sin
     el mapa la aplicación no termina de armarse. Es una limitación del
     sitio donde corren las pruebas, no de URBIS. */
  const LEAFLET = (E.TRABAJO || '') + 'node_modules/leaflet/dist/';
  await pg.route('**/leaflet*.js', r => r.fulfill({ contentType: 'application/javascript',
    body: fs.readFileSync(LEAFLET + 'leaflet.js', 'utf8') }));
  await pg.route('**/leaflet*.css', r => r.fulfill({ contentType: 'text/css',
    body: fs.readFileSync(LEAFLET + 'leaflet.css', 'utf8') }));
  await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  // Ponerse un rol sin pasar por el login de verdad. `urbisEsAdmin` solo
  // cree lo que dijo el servidor en la sesión, así que para el caso admin
  // hay que sustituir esa lectura; para JAC basta el rol global.
  await pg.evaluate(() => {
    window.__authReal = window.URBIS_AUTH;
    window.__ponerRol = function (rol, nombre) {
      window.userRole = rol === 'admin' ? 'admin' : (rol || 'citizen');
      window.userNameGlobal = nombre || '';
      window.userUsernameGlobal = nombre || '';
      window.userEmailGlobal = ''; window.userCedulaGlobal = '';
      document.body.dataset.role = window.userRole;
      window.URBIS_AUTH = (rol === 'admin')
        ? Object.assign({}, window.__authReal, { readSession: () => ({ usuario: 'moderadora', rol: 'admin' }) })
        : Object.assign({}, window.__authReal, { readSession: () => ({}) });
    };
  });
  const conRol = (rol, nombre) => pg.evaluate(([r, n]) => window.__ponerRol(r, n), [rol, nombre || '']);

  // ── 1. El portero de la foto ───────────────────────────────────────────
  chk(await pg.evaluate(() => typeof window.urbisFotoDeReporte === 'function'),
      'el portero de la foto existe y está expuesto');

  /* Los lectores devuelven un objeto vacío en vez de reventar cuando la
     pieza todavía no existe. Es lo que permite correr esta suite contra la
     versión anterior y LEER qué falta, en vez de recibir una excepción que
     no dice nada. */
  const NADA = { hay: false, publicada: false, puedeVerla: false, enRevision: false, esModerador: false };
  const preguntar = (p) => pg.evaluate(q => {
    if (typeof window.urbisFotoDeReporte !== 'function') return null;
    const r = window.urbisFotoDeReporte(q) || {};
    return { hay: !!r.hay, publicada: !!r.publicada, puedeVerla: !!r.puedeVerla, enRevision: !!r.enRevision, esModerador: !!r.esModerador };
  }, p).then(r => r || NADA);

  await conRol('citizen', 'Otra Persona');
  let r = await preguntar(punto({ estado: 'Aprobado', autor: 'Marta Ríos' }));
  chk(r.hay && r.publicada && r.puedeVerla && !r.enRevision,
      'un reporte aprobado enseña su foto a cualquiera');

  r = await preguntar(punto({ estado: 'Pendiente', autor: 'Marta Ríos' }));
  chk(r.hay && !r.publicada && !r.puedeVerla && r.enRevision,
      'un reporte PENDIENTE no le enseña la foto a quien pasa por ahí');

  r = await preguntar(punto({ estado: 'Pendiente', foto: '', autor: 'Marta Ríos' }));
  chk(!r.hay && !r.enRevision,
      'y si el reporte no trajo foto, no se anuncia una foto que no existe');

  // Hacia atrás: miles de reportes viejos no llevan estado escrito. Tratarlos
  // como pendientes escondería de golpe fotos publicadas hace meses. Eso no
  // es moderar, es romper.
  r = await preguntar(punto({ estado: '', autor: 'Marta Ríos' }));
  chk(r.publicada && r.puedeVerla,
      'un reporte viejo sin estado escrito se trata como aprobado: no se esconde nada hacia atrás');

  // El autor ve la suya: si no, la manda tres veces creyendo que se perdió.
  await conRol('citizen', 'Marta Ríos');
  r = await preguntar(punto({ estado: 'Pendiente', autor: 'Marta Ríos' }));
  chk(r.puedeVerla && r.enRevision && !r.esModerador,
      'quien subió la foto sí la ve mientras espera, y se le dice que está en revisión');

  await conRol('gov', 'Junta de Acción');
  r = await preguntar(punto({ estado: 'Pendiente', autor: 'Marta Ríos' }));
  chk(r.puedeVerla && r.esModerador && r.enRevision,
      'el moderador la ve —tiene que verla para poder aprobarla— y sabe que aún no está publicada');

  await conRol('admin', 'Moderadora');
  r = await preguntar(punto({ estado: 'Pendiente', autor: 'Marta Ríos' }));
  chk(r.puedeVerla && r.esModerador,
      'y el administrador también');

  // ── 2. El globo del mapa, construido por la aplicación de verdad ───────
  const globo = (p) => pg.evaluate(q => {
    if (typeof window.urbisCrearMarcadorUrbano !== 'function') return null;
    let m = null;
    try { m = window.urbisCrearMarcadorUrbano(q.lat, q.lng, q.tipo, q); } catch (e) { return null; }
    if (!m) return null;
    const pop = m.getPopup();
    const ic = m.options.icon && m.options.icon.options ? m.options.icon.options : {};
    return {
      html: pop ? String(pop.getContent() || '') : '',
      clase: String(ic.className || ''),
      iconoHTML: String(ic.html || '')
    };
  }, p);

  chk(await pg.evaluate(() => typeof window.urbisCrearMarcadorUrbano === 'function'),
      'el constructor de marcadores está expuesto y se puede medir de verdad');

  await conRol('citizen', 'Otra Persona');
  let g = await globo(punto({ estado: 'Pendiente', autor: 'Marta Ríos' }));
  chk(!!g, 'se construye el globo de un reporte pendiente');
  if (g) {
    chk(!/class="popup-foto-big/.test(g.html),
        'el ciudadano NO recibe la etiqueta de la foto en el globo de un reporte pendiente');
    /* En la v829 esto se comprobaba buscando el bloque `foto-en-revision`.
       La v832 ensanchó el portero: al ciudadano ya no se le esconde solo la
       foto sino todo el detalle, y el aviso que recibe es el de «sin
       confirmar», que nombra la foto dentro. La intención que esta línea
       defiende no cambió —hay que DECIRLE que se está guardando algo, un
       hueco en blanco se lee como «no trajo pruebas»— así que se comprueba
       la intención y no el nombre de la caja: que haya un aviso y que
       nombre la foto. */
    chk(/(foto-en-revision|popup-sin-confirmar)/.test(g.html) && /foto/i.test(g.html),
        'pero sí le dice que hay una foto guardada hasta que se revise: un hueco en blanco se lee como «no trajo pruebas»');
    chk(!/popup-admin-actions/.test(g.html),
        'y no le sale el botón de aprobar');
    // La dirección de la foto tampoco se escribe en el globo: esconder la
    // etiqueta y dejar el enlace al lado no esconde nada.
    chk(!/ejemplo\.local\/prueba\.jpg/.test(g.html),
        'ni la dirección de la foto viaja al globo de quien no puede verla');
  }

  await conRol('gov', 'Junta de Acción');
  g = await globo(punto({ estado: 'Pendiente', autor: 'Marta Ríos' }));
  if (g) {
    chk(/class="popup-foto-big popup-foto-en-revision"/.test(g.html),
        'al moderador sí le llega la foto, marcada como todavía sin publicar');
    chk(/popup-admin-actions/.test(g.html) && /aprobarPunto/.test(g.html),
        'y el botón de aprobar, dentro del globo, sin salir del mapa');
    chk(/cédula/i.test(g.html),
        'con la advertencia de qué está aprobando: la foto y la cédula de quien la subió');
    chk(/urbis-por-aprobar/.test(g.clase) && /urbis-sello-aprobar/.test(g.iconoHTML),
        'y el marcador lleva el sello de «falta por aprobar»');
  }

  g = await globo(punto({ estado: 'Aprobado', autor: 'Marta Ríos' }));
  if (g) {
    chk(!/popup-admin-actions/.test(g.html),
        'un reporte YA aprobado no vuelve a ofrecer el botón de aprobar');
    chk(!/urbis-por-aprobar/.test(g.clase) && !/urbis-sello-aprobar/.test(g.iconoHTML),
        'ni sigue en la cola de trabajo del moderador');
    chk(/class="popup-foto-big"/.test(g.html),
        'y su foto se ve, sin el sello de revisión');
  }

  /* El sello se cuelga como un elemento propio y no como un `::after` del
     icono. `urbis-luto` ya se quedó con el `::before` y el `::after` de ese
     mismo elemento (su halo y su onda) y un reporte pendiente CON fallecidos
     existe: si los dos pelearan por el mismo pseudo-elemento, ganaría uno y
     el otro desaparecería sin avisar. */
  const cssLuto = fs.readFileSync(REPO + '/css/01-base-layout.css', 'utf8');
  const css83 = fs.existsSync(REPO + '/css/83-moderacion-foto.css')
    ? fs.readFileSync(REPO + '/css/83-moderacion-foto.css', 'utf8') : '';
  chk(css83.length > 0, 'existe la hoja de moderación (css/83-moderacion-foto.css)');
  chk(/\.urbis-luto::after\{/.test(cssLuto), 'urbis-luto sigue usando ::after para su onda');
  chk(css83.length > 0 && !/\.urbis-por-aprobar::(after|before)\s*\{/.test(css83),
      'el sello no le disputa el ::after al luto: cuelga de un elemento propio');

  // ── 3. La cascada: quién ve el sello y quién no ────────────────────────
  // Con css/main.css ENTERO, que es lo que carga el teléfono.
  const medir = (rol) => pg.evaluate(r => {
    document.body.dataset.role = r;
    let caja = document.getElementById('__pru_aprobar');
    if (!caja) {
      caja = document.createElement('div');
      caja.id = '__pru_aprobar';
      caja.innerHTML =
        '<div class="leaflet-marker-icon urbis-report-root urbis-por-aprobar" id="__pru_icono">' +
          '<span class="urbis-sello-aprobar">⏳</span><span>📍</span>' +
        '</div>' +
        '<div class="urbis-popup"><div class="popup-admin-actions" id="__pru_btns">' +
          '<button class="pa-aprobar">✅ Aprobar reporte</button></div>' +
          '<div class="popup-admin-nota" id="__pru_nota">nota</div></div>';
      document.body.appendChild(caja);
    }
    const cs = id => getComputedStyle(document.getElementById(id));
    return {
      selloDisplay: getComputedStyle(document.querySelector('#__pru_icono .urbis-sello-aprobar')).display,
      botones: cs('__pru_btns').display,
      nota: cs('__pru_nota').display,
      iconoPos: cs('__pru_icono').position,
      iconoOverflow: cs('__pru_icono').overflow
    };
  }, rol);

  const mCiud = await medir('citizen').catch(() => ({ selloDisplay: '?', botones: '?', nota: '?', iconoPos: '?', iconoOverflow: '?' }));
  chk(mCiud.selloDisplay === 'none',
      'el ciudadano no ve el sello: la cola de trabajo de otro solo estorba');
  chk(mCiud.botones === 'none' && mCiud.nota === 'none',
      'ni el botón de aprobar, aunque el globo se hubiera quedado dibujado de una sesión anterior');

  const mAdmin = await medir('admin').catch(() => ({ selloDisplay: '?', botones: '?', nota: '?', iconoPos: '?', iconoOverflow: '?' }));
  /* Se exige `flex` y no «cualquier cosa que no sea none»: un `<span>` sin
     una sola regla que lo toque también sale distinto de `none` —sale
     `inline`— y esa comprobación pasaría con la hoja sin cargar, que es
     justo el fallo que se quiere ver. Flex es además lo que centra el
     reloj dentro del círculo; si deja de serlo, el sello sale descuadrado. */
  chk(mAdmin.selloDisplay === 'flex',
      'el administrador sí ve el sello, centrado en su círculo (' + mAdmin.selloDisplay + ')');
  chk(mAdmin.botones === 'flex' && mAdmin.nota === 'block',
      'y el botón de aprobar con su advertencia (' + mAdmin.botones + ' / ' + mAdmin.nota + ')');

  const mGov = await medir('gov').catch(() => ({ selloDisplay: '?', botones: '?' }));
  chk(mGov.selloDisplay === 'flex' && mGov.botones === 'flex',
      'la JAC modera igual que el administrador');

  /* El error que casi se sube: colgar el sello poniendo `position:relative`
     en el icono. Leaflet posiciona sus iconos en `absolute`, y pisarlo los
     despega de su coordenada — todos los reportes pendientes se irían a
     otro sitio del mapa. El icono ya es bloque contenedor sin tocarle nada. */
  chk(mAdmin.iconoPos === 'absolute',
      'el icono del marcador sigue en position:absolute: el sello no lo despegó de su coordenada');
  /* `overflow:visible` es además el valor por omisión, así que medirlo a
     secas pasaría sin que nadie lo hubiera escrito. Se exige la regla
     ESCRITA: otras hojas del proyecto recortan iconos, y ahí el sello se
     iría con el recorte. */
  chk(mAdmin.iconoOverflow === 'visible' &&
      /\.leaflet-marker-icon\.urbis-por-aprobar\{\s*overflow:\s*visible/.test(css83),
      'y deja salir el sello de su recuadro —dicho a propósito—, como ya hacía el luto');

  // ── 4. Aprobar de verdad, desde el globo ───────────────────────────────
  // Se comprueba el efecto: la fila que sale hacia el servidor lleva la
  // casilla de aprobación en «Aprobado» y NADA MÁS cambiado. Aprobar que de
  // paso reescribiera la nota del ciudadano sería peor que no aprobar.
  const envio = await pg.evaluate(async (b) => {
    const original = window.urbisDBUpdate;
    const p = { lat: 9.999, lng: -75.5, tipo: '🚨 Alertas y Riesgos Urbanos', descripcion: '' };
    const d = new Array(b + 8).fill('');
    // La nota va sin barras verticales a propósito: al guardarla, la
    // aplicación ya las cambia por guiones (js/12), porque la barra es el
    // separador de la fila. Escribir una acá probaría un caso que no existe.
    d[0] = 'Hueco en la vía'; d[1] = 'Hueco'; d[2] = 'Lleva semanas y ya se cayó una moto.';
    d[b] = 'https://ejemplo.local/prueba.jpg'; d[b + 1] = 'Pendiente'; d[b + 2] = 'Marta Ríos';
    p.descripcion = d.join(' | ');
    const filaOriginal = p.descripcion;
    /* `globalData` es una variable del ámbito compartido de los scripts, no
       una propiedad de `window`: se toca por su nombre y se deja como
       estaba. Y se sustituye la recarga de puntos, que saldría a la red del
       servidor de datos y acá no hay red. */
    const antesDatos = globalData.slice();
    const recargaReal = window.cargarPuntos;
    let capturado = null;
    globalData.length = 0; globalData.push(p);
    window.cargarPuntos = () => {};
    window.urbisDBUpdate = (k, v, campos) => { capturado = { k, v, campos }; return Promise.resolve({ ok: true }); };
    const btn = document.createElement('button');
    btn.innerHTML = '✅ Aprobar reporte';
    if (typeof window.aprobarPunto !== 'function') { window.urbisDBUpdate = original; return null; }
    try { await window.aprobarPunto(p.lat, btn); } catch (e) {}
    window.urbisDBUpdate = original;
    window.cargarPuntos = recargaReal;
    globalData.length = 0; antesDatos.forEach(x => globalData.push(x));
    return capturado
      ? { k: capturado.k, v: String(capturado.v), desc: String(capturado.campos.descripcion || ''), antes: filaOriginal }
      : null;
  }, BASE);

  chk(!!envio, 'aprobar llega a mandar la fila al servidor');
  if (envio) {
    const partes = envio.desc.split(' | ');
    const antes = envio.antes.split(' | ');
    chk(partes[BASE + 1] === 'Aprobado', 'la casilla de aprobación queda en «Aprobado»');
    // Y NADA MÁS. Aprobar que de paso reescribiera la nota del ciudadano, o
    // su foto, o su nombre, sería peor que no aprobar: la fila que se
    // publica dejaría de ser la que esa persona escribió.
    const tocadas = partes
      .map((v, i) => (v === antes[i] ? null : i))
      .filter(i => i !== null && i !== BASE + 1);
    chk(partes.length === antes.length && tocadas.length === 0,
        'y ninguna otra casilla de la fila se movió' + (tocadas.length ? ' (se movieron: ' + tocadas.join(', ') + ')' : ''));
    chk(envio.k === 'lat', 'se identifica la fila por su latitud, como el resto de la aplicación');
  }

  /* Al fallar, el botón tiene que volver a decir lo que decía. Antes esto
     escribía «✅ APROBAR REPORTE» viniera de donde viniera: desde el globo
     dejaba un botón con el texto del detalle, que es otro sitio. */
  const j12 = fs.readFileSync(REPO + '/js/12-spa-ui.js', 'utf8');
  const bloqueAprobar = (j12.match(/window\.aprobarPunto = function[\s\S]*?\n  \};/) || [''])[0];
  chk(bloqueAprobar.length > 100, 'se encuentra el bloque de aprobar');
  chk(/etiquetaOriginal/.test(bloqueAprobar) && !/innerText = "✅ APROBAR REPORTE"/.test(bloqueAprobar),
      'el botón recupera SU etiqueta al fallar, no la del otro sitio');

  // ── 5. La lista de eventos: el portero no puede tragarse fotos ─────────
  /* Este bloque existe por un error cometido al escribir la v829: la fila de
     un evento comunitario guarda su foto en OTRA casilla que la de un
     reporte (js/09), así que preguntarle al portero por la casilla de los
     reportes devolvía «acá no hay foto» — y el llamador, obediente,
     escondía TODAS las fotos de eventos. Ni siquiera las escondía por estar
     en revisión: las borraba de la tarjeta.

     Se mide sobre el renderizador de verdad, con una fila de evento de
     verdad, porque el error no estaba en el portero sino en la costura. */
  const tarjeta = (estado, conFoto) => pg.evaluate(([est, foto, b]) => {
    const d = new Array(b + 8).fill('');
    // Formato «mapa» de js/09: título, lugar, detalle, fecha ISO, hora,
    // creador, foto, tipo, icono.
    d[0] = 'Bazar del barrio'; d[1] = 'Cancha La Floresta'; d[2] = 'Con música y comida.';
    d[3] = '2099-12-24'; d[4] = '15:00'; d[5] = 'Marta Ríos';
    d[6] = foto ? 'https://ejemplo.local/evento.jpg' : '';
    d[7] = 'Evento comunitario';
    d[b + 1] = est;
    const p = { lat: 6.2001, lng: -75.57, tipo: 'Evento', descripcion: d.join(' | ') };
    return { fila: p.descripcion, foto: (typeof window.urbisFotoDeReporte === 'function') ? window.urbisFotoDeReporte(p, d[6]) : null };
  }, [estado, conFoto, BASE]);

  await conRol('citizen', 'Otra Persona');
  let t = await tarjeta('Aprobado', true);
  chk(t.foto && t.foto.hay && t.foto.puedeVerla,
      'la foto de un evento APROBADO se sigue viendo: el portero no la pierde por mirar la casilla del reporte');
  t = await tarjeta('Pendiente', true);
  chk(t.foto && t.foto.hay && !t.foto.puedeVerla && t.foto.enRevision,
      'y la de un evento pendiente espera igual que la de un reporte');
  t = await tarjeta('Aprobado', false);
  chk(t.foto && !t.foto.hay,
      'un evento sin foto sigue sin foto, sin avisos de una que no existe');
  /* La misma advertencia tiene que estar en las DOS puertas de aprobar. El
     detalle era la puerta vieja; si la advertencia solo estuviera en el
     globo, quien aprueba desde el detalle seguiría apretando un botón verde
     que no dice qué afirma. */
  const j10 = fs.readFileSync(REPO + '/js/10-visible-markers.js', 'utf8');
  /* Se cuenta la FRASE del aviso, no la palabra «cédula» suelta: js/10
     nombra la cédula ocho veces, casi todas explicando por qué NO se
     muestra. Contar la palabra daría verde con el aviso borrado. */
  const puertasConAviso = (j10.match(/su cédula es real/g) || []).length;
  chk(puertasConAviso === 2,
      'las dos puertas de aprobar —el globo y el detalle— dicen que se está avalando también la cédula (' + puertasConAviso + ' de 2)');
  chk(/nota-aprobar-detalle/.test(j10) && /nota-aprobar-detalle\{[^}]*display:block/.test(css83),
      'y la del detalle se ve siempre: la construye la rama de administrador, esconderla por rol la apagaría para quien debe leerla');

  const j09 = fs.readFileSync(REPO + '/js/09-events.js', 'utf8');
  chk(/urbisFotoDeReporte\(p, ev\.foto\)/.test(j09),
      'la lista de eventos le PASA al portero dónde está su foto, en vez de dejar que la busque donde no está');

  // ── 6. Ninguna otra puerta enseña la foto sin pasar por el portero ─────
  const puertas = ['js/10-visible-markers.js', 'js/09-events.js'];
  const sinPortero = puertas.filter(f => {
    const s = fs.readFileSync(REPO + '/' + f, 'utf8');
    return /urbisAbrirFotoFull/.test(s) && !/urbisFotoDeReporte/.test(s);
  });
  chk(sinPortero.length === 0,
      'todo sitio que pinta la foto de un reporte pasa por el portero' +
      (sinPortero.length ? ': ' + sinPortero.join(', ') : ''));

  const main = fs.readFileSync(REPO + '/css/main.css', 'utf8');
  chk(/83-moderacion-foto\.css/.test(main),
      'la hoja de moderación entra por main.css: si no, nada de esto se ve en el teléfono');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
