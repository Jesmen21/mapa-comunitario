const E = require('../entorno.js');
/* SIN CONFIRMAR: EL ICONO Y LA CATEGORÍA, NADA MÁS (v832)
   ────────────────────────────────────────────────────────────────────────
   Se propuso así: «si hay un homicidio y hay una foto y no se ha verificado
   la cuenta, que solamente salga el ícono, pero sin descripción. Solo que
   salga el ícono y un pequeño título de homicidio, depende la categoría que
   se haya elegido… la gente va pasando y solo ve un ícono ahí. Sabe que
   hubo un homicidio, pero no dan detalles, hasta que se confirme por un
   administrador».

   La v829 guardaba solo la FOTO. Faltaba lo de al lado, que es lo que de
   verdad puede arruinar a alguien: una foto de una esquina no acusa a
   nadie; «aquí mataron a Fulano, fue el hijo del vecino de la 32» sí, y esa
   frase se escribe en treinta segundos, sale publicada al instante y la lee
   el barrio mientras un administrador duerme.

   La línea que separa lo que sale de lo que espera no es «importante o no»:
   es QUIÉN LO ESCRIBIÓ.
     · La CATEGORÍA sale de una lista cerrada de URBIS. Nadie puede meter un
       nombre propio dentro. Sale.
     · El título y la nota los teclea quien reporta. Esperan.
     · Las víctimas son una afirmación de hecho sobre algo que quizá nadie
       vio. Espera.
     · Y quién reportó espera, pero por él, no por el acusado: su nombre
       bajo una denuncia de homicidio sin confirmar, en un mapa público,
       señala a la persona que se atrevió a contarlo.

   El punto en el mapa NO se guarda. Sirve para no pasar por ahí esta noche
   —que es para lo que la gente abre URBIS— y avisa de un sitio en vez de
   acusar a una persona. Guardarlo también sería censurar el aviso, no
   moderar la acusación; esta suite lo comprueba en los dos sentidos.

   Se mide contra el constructor de globos y el de detalle DE VERDAD, y se
   busca el texto delator dentro de lo pintado. Una prueba que solo mirara
   si existe la caja del aviso pasaría igual con la nota impresa debajo. */
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

  const j04 = fs.readFileSync(REPO + '/js/04-marker-proximity.js', 'utf8');
  const contarUsos = re => { const m = j04.match(re); return m ? (m[1].match(/"/g) || []).length / 2 : 0; };
  const BASE = 6 + contarUsos(/const usosBase = \[([\s\S]*?)\];/) + contarUsos(/const usosExtra = \[([\s\S]*?)\];/);
  chk(BASE > 20, 'se pudo contar la casilla base de la fila (' + BASE + ')');

  /* El caso del que se habló, con las palabras delatoras puestas a
     propósito: si alguna aparece en lo que ve un vecino cualquiera, el
     portero no está cerrado. */
  const TITULO_LIBRE = 'Mataron a Juan Perez en la esquina';
  const NOTA_LIBRE = 'Dicen que fue el hijo del vecino de la 32, el del taller.';
  const AUTOR = 'Marta Rios';

  const punto = (estado) => {
    const d = new Array(BASE + 9).fill('');
    d[0] = 'Homicidio';
    d[1] = TITULO_LIBRE;
    d[2] = NOTA_LIBRE;
    d[3] = 'Malo';
    d[BASE] = 'https://ejemplo.local/prueba.jpg';
    d[BASE + 1] = estado;
    d[BASE + 2] = AUTOR;
    d[BASE + 3] = 'citizen';
    d[BASE + 4] = '0';
    d[BASE + 7] = 'La Floresta';
    return { lat: 6.2518, lng: -75.5636, tipo: '🚨 Alertas y Riesgos Urbanos', descripcion: d.join(' | ') };
  };

  await pg.evaluate(() => {
    window.__authReal = window.URBIS_AUTH;
    window.__ponerRol = function (rol, nombre) {
      window.userRole = rol === 'admin' ? 'admin' : (rol || 'citizen');
      window.userNameGlobal = nombre || '';
      window.userUsernameGlobal = nombre || '';
      window.userEmailGlobal = ''; window.userCedulaGlobal = '';
      document.body.dataset.role = window.userRole;
      window.URBIS_AUTH = (rol === 'admin')
        ? Object.assign({}, window.__authReal, { readSession: () => ({ usuario: 'moderadora', rol: 'admin', es_admin: true }) })
        : Object.assign({}, window.__authReal, { readSession: () => ({}) });
    };
  });
  const conRol = (rol, nombre) => pg.evaluate(([r, n]) => window.__ponerRol(r, n), [rol, nombre || '']);

  // ── 1. El decisor único ────────────────────────────────────────────────
  chk(await pg.evaluate(() => typeof window.urbisVisibilidadReporte === 'function'),
      'hay un solo sitio que decide qué se publica de un reporte');

  const preguntar = (p) => pg.evaluate(q => {
    if (typeof window.urbisVisibilidadReporte !== 'function') return null;
    const v = window.urbisVisibilidadReporte(q);
    return { publicado: !!v.publicado, enRevision: !!v.enRevision, verDetalle: !!v.verDetalle, esModerador: !!v.esModerador };
  }, p);

  await conRol('citizen', 'Otra Persona');
  let v = await preguntar(punto('Aprobado'));
  chk(v && v.publicado && v.verDetalle, 'un reporte aprobado se ve entero');
  v = await preguntar(punto('Pendiente'));
  chk(v && v.enRevision && !v.verDetalle, 'uno sin confirmar no le enseña los detalles a un vecino cualquiera');
  await conRol('citizen', AUTOR);
  v = await preguntar(punto('Pendiente'));
  chk(v && v.verDetalle && !v.esModerador, 'pero sí a quien lo escribió: tiene que saber que se envió bien');
  await conRol('gov', 'Junta');
  v = await preguntar(punto('Pendiente'));
  chk(v && v.verDetalle && v.esModerador, 'y al moderador, que para eso tiene que leerlo');

  /* El portero de la foto cuelga del mismo decisor. Dos porteros con
     criterios separados acaban enseñando la nota y escondiendo la foto, o
     al revés, y nadie se entera hasta que pasa. */
  const j05 = fs.readFileSync(REPO + '/js/05-helpers-temporal-security.js', 'utf8');
  const bloqueFoto = (j05.match(/function urbisFotoDeReporte[\s\S]*?\n  \}/) || [''])[0];
  chk(/urbisVisibilidadReporte\(/.test(bloqueFoto),
      'el portero de la foto usa ese mismo decisor y no uno propio');

  // ── 2. El globo del mapa ───────────────────────────────────────────────
  const globo = (p) => pg.evaluate(q => {
    if (typeof window.urbisCrearMarcadorUrbano !== 'function') return null;
    let m = null;
    try { m = window.urbisCrearMarcadorUrbano(q.lat, q.lng, q.tipo, q); } catch (e) { return null; }
    const pop = m && m.getPopup();
    return pop ? String(pop.getContent() || '') : '';
  }, p);

  await conRol('citizen', 'Otra Persona');
  const gPend = await globo(punto('Pendiente'));
  chk(gPend !== null, 'se construye el globo de un reporte sin confirmar');
  if (gPend !== null) {
    // Lo que NO puede salir, palabra por palabra.
    chk(gPend.indexOf('Juan Perez') === -1, 'el globo NO lleva el título libre («Mataron a Juan Perez…»)');
    chk(gPend.indexOf('hijo del vecino') === -1, 'ni la nota, que es donde va la acusación');
    chk(gPend.indexOf('Marta') === -1, 'ni el nombre de quien reportó: eso lo señalaría a él');
    chk(gPend.indexOf('ejemplo.local') === -1, 'ni la dirección de la foto');
    // Lo que SÍ tiene que salir.
    chk(/Homicidio/.test(gPend), 'pero sí la categoría, que se elige de una lista y no la escribe nadie');
    chk(/[Ss]in confirmar/.test(gPend), 'y el aviso de que está sin confirmar');
    chk(/popup-icon-badge/.test(gPend), 'con su icono, que es lo que se ve al pasar por el mapa');
  }

  // Aprobado: vuelve todo. Si esto falla, el portero se quedó cerrado.
  const gOk = await globo(punto('Aprobado'));
  if (gOk !== null) {
    chk(gOk.indexOf('Juan Perez') !== -1 && gOk.indexOf('hijo del vecino') !== -1,
        'aprobado, el globo sí enseña el título y la nota');
    chk(gOk.indexOf('Marta') !== -1, 'y quién lo reportó');
  }

  // El moderador lo ve entero desde el primer segundo.
  await conRol('gov', 'Junta');
  const gMod = await globo(punto('Pendiente'));
  if (gMod !== null) {
    chk(gMod.indexOf('hijo del vecino') !== -1,
        'el moderador sí lee la nota sin confirmar: no puede decidir sin leerla');
    chk(/popup-admin-actions/.test(gMod), 'y tiene ahí el botón de aprobar');
  }

  // ── 3. El punto NO se esconde: eso sería censurar el aviso ─────────────
  await conRol('citizen', 'Otra Persona');
  const enMapa = await pg.evaluate(q => {
    if (typeof window.urbisCrearMarcadorUrbano !== 'function') return null;
    const m = window.urbisCrearMarcadorUrbano(q.lat, q.lng, q.tipo, q);
    const ic = m && m.options.icon && m.options.icon.options ? m.options.icon.options : {};
    return { hayMarcador: !!m, clase: String(ic.className || ''), html: String(ic.html || '') };
  }, punto('Pendiente'));
  chk(!!(enMapa && enMapa.hayMarcador),
      'el punto sigue en el mapa: sirve para no pasar por ahí esta noche, y avisa de un sitio, no acusa a una persona');
  chk(!!(enMapa && enMapa.html.indexOf('Juan Perez') === -1 && enMapa.html.indexOf('hijo del vecino') === -1),
      'y el marcador tampoco lleva el texto libre escondido dentro');

  // ── 4. El detalle ──────────────────────────────────────────────────────
  const detalle = (p) => pg.evaluate(q => {
    if (typeof window.mostrarDetalles !== 'function' && typeof mostrarDetalles !== 'function') return null;
    try { (window.mostrarDetalles || mostrarDetalles)(q); } catch (e) { return null; }
    const c = document.getElementById('info-content');
    return c ? c.textContent : null;
  }, p);

  await conRol('citizen', 'Otra Persona');
  const dPend = await detalle(punto('Pendiente'));
  chk(dPend !== null, 'se pinta el detalle de un reporte sin confirmar');
  if (dPend !== null) {
    chk(dPend.indexOf('Juan Perez') === -1, 'el detalle NO lleva el título libre');
    chk(dPend.indexOf('hijo del vecino') === -1, 'ni la nota');
    chk(dPend.indexOf('Marta') === -1, 'ni el nombre de quien reportó');
    chk(/Homicidio/.test(dPend), 'pero sí la categoría');
    chk(/[Ss]in confirmar/.test(dPend), 'y dice que está sin confirmar y qué se está guardando');
  }
  const dOk = await detalle(punto('Aprobado'));
  if (dOk !== null) {
    chk(dOk.indexOf('hijo del vecino') !== -1 && dOk.indexOf('Marta') !== -1,
        'aprobado, el detalle vuelve entero');
  }
  await conRol('gov', 'Junta');
  const dMod = await detalle(punto('Pendiente'));
  if (dMod !== null) {
    chk(dMod.indexOf('hijo del vecino') !== -1, 'el moderador lee el detalle completo desde el primer segundo');
  }
  await conRol('citizen', AUTOR);
  const dMio = await detalle(punto('Pendiente'));
  if (dMio !== null) {
    chk(dMio.indexOf('hijo del vecino') !== -1, 'y su autor también, para saber que se envió bien');
  }

  // ── 5. Hacia atrás no se esconde nada ──────────────────────────────────
  await conRol('citizen', 'Otra Persona');
  const viejo = await pg.evaluate(([base, t, n]) => {
    const d = new Array(base + 9).fill('');
    d[0] = 'Homicidio'; d[1] = t; d[2] = n; d[base + 1] = ''; d[base + 2] = 'Marta Rios';
    const q = { lat: 6.25, lng: -75.56, tipo: '🚨 Alertas y Riesgos Urbanos', descripcion: d.join(' | ') };
    const v = window.urbisVisibilidadReporte ? window.urbisVisibilidadReporte(q) : null;
    return v ? { publicado: !!v.publicado, verDetalle: !!v.verDetalle } : null;
  }, [BASE, TITULO_LIBRE, NOTA_LIBRE]);
  chk(!!(viejo && viejo.publicado && viejo.verDetalle),
      'un reporte de antes del portero, sin estado escrito, sigue publicado: esconder hacia atrás miles no es moderar, es romper');

  // ── 6. Una sola plantilla, no dos ──────────────────────────────────────
  /* El detalle se recorta con variables sobre UNA plantilla. Con dos
     plantillas, la que enseña de más es siempre la que alguien olvida
     actualizar. */
  const j10 = fs.readFileSync(REPO + '/js/10-visible-markers.js', 'utf8');
  const vecesHeader = (j10.match(/class="header-identificador"/g) || []).length;
  chk(vecesHeader === 1,
      'el detalle no se partió en dos plantillas: se recorta con variables sobre la misma (' + vecesHeader + ')');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
