const E = require('../entorno.js');
/* LA ENTREGA DEL CURSO AL SERVIDOR (js/81)

   Hasta la v817 lo que un grupo escribía en el modo educativo vivía solo en
   `localStorage`: cinco teléfonos eran cinco memorias y el profesor no veía
   ninguna. Esta suite fija las reglas del módulo que lo recoge, que son las
   que no se pueden aflojar sin perder trabajo ajeno o abrirlo a un tercero:

   · la fila se llama «comentario» —único tipo al que el servidor le aplica
     «la edita quien la escribió»— y por eso mismo nunca se pinta en el mapa;
   · el campo denunciable (el 2) va vacío: es el único que un tercero puede
     reescribir sin ser el autor;
   · el texto del grupo sobrevive intacto al viaje, incluidos los caracteres
     que parten esta tubería: `~~~`, ` | `, un correo, tildes y emoji;
   · el mismo grupo sobre el mismo sector REESCRIBE su entrega; el grupo de
     al lado escribe la suya;
   · una entrega que no cabe se rechaza diciendo cuál lectura acortar, en vez
     de mandarla para que el servidor la corte por la mitad.

   Corre sobre una página desnuda con el módulo solo: las dependencias
   (usuario, sesión, escritura, lectura) se inyectan, que es la única manera
   de saber qué escribió y con qué tipo.                                  */
const { chromium } = require(E.MODULOS + '/playwright-core');
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 500, height: 700 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  await pg.setContent('<div id="edu-analisis-salida"></div>');
  /* Contra una versión sin el módulo, la suite tiene que INFORMAR, no
     reventar: un fallo que se ve como una caída de node no dice cuál
     regla se perdió. */
  try { await pg.addScriptTag({ path: REPO + '/js/81-curso-servidor.js' }); } catch (e) {}

  // Un texto con TODO lo que rompe esta tubería, para el viaje de ida y vuelta.
  const DUELE = 'Falta sombra ~~~ y el andén | mide 0,80 m. Escríbannos a curso@ufps.edu.co · «acá» 🌳 60 %';

  const hay = await pg.evaluate(() => !!window.URBIS_CURSO);
  chk(hay, 'el módulo del curso existe');
  if (!hay) {
    console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
    console.log('\n' + fallo.concat(['sin módulo no se puede seguir']).map(t => '  ✗ ' + t).join('\n'));
    console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length + 1));
    await b.close(); process.exit(1);
  }

  // ── El escenario ───────────────────────────────────────────────────────
  await pg.evaluate(() => {
    window.__escritas = [];     // lo que llegó a `crear`
    window.__updates = [];      // lo que llegó a `actualizar`
    window.__filas = [];        // la "hoja" del servidor
    window.__sesion = true;
    window.__yo = 'Ana.Pérez';
    URBIS_CURSO.configurar({
      ahora: () => Date.UTC(2026, 8, 8, 15, 0, 0),
      usuario: () => window.__yo,
      haySesion: () => window.__sesion,
      crear: f => { window.__escritas.push(f); window.__filas.push(f); return Promise.resolve({ ok: true }); },
      actualizar: (tipo, campos) => {
        window.__updates.push({ tipo, campos });
        const i = window.__filas.findIndex(f => f.tipo === tipo);
        if (i < 0) return Promise.resolve({ ok: true, updated: 0 });
        window.__filas[i] = Object.assign({}, window.__filas[i], campos);
        return Promise.resolve({ ok: true, updated: 1 });
      },
      leerTodo: () => Promise.resolve(window.__filas.slice()),
      guardar: v => { window.__curso = v; },
      cargar: () => window.__curso || ''
    });
  });

  // ── 1 · El tipo de la fila ─────────────────────────────────────────────
  const t = await pg.evaluate(() => {
    const a = URBIS_CURSO.tipoDe('Taller 5B · UFPS', 'Ana.Pérez', '7.8891,-72.5000|500');
    const b = URBIS_CURSO.tipoDe('taller 5b  ufps', 'Ana.Pérez', '7.8891,-72.5000|500');   // mismo curso, otras mayúsculas
    const c = URBIS_CURSO.tipoDe('Taller 5B · UFPS', 'Beto', '7.8891,-72.5000|500');        // otro grupo
    const d = URBIS_CURSO.tipoDe('Taller 5B · UFPS', 'Ana.Pérez', '7.8891,-72.5000|1000');  // otro radio
    return { a, b, c, d };
  });
  chk(t.a.indexOf('comentario') === 0,
      'el tipo empieza por «comentario»: es lo que hace que el servidor deje corregir solo al autor');
  chk(t.a === t.b, 'el mismo curso escrito con otras mayúsculas y tildes es el mismo curso');
  chk(t.a !== t.c, 'el grupo de al lado escribe en otra fila, no encima de la ajena');
  chk(t.a !== t.d, 'y cambiar el radio es otro sector, no la misma entrega');

  // ── 2 · La fila y su descripción ───────────────────────────────────────
  const f = await pg.evaluate((DUELE) => {
    const carga = URBIS_CURSO.armar(null, { general: DUELE, flujo: 'Poca gente a pie.' },
                                    { lat: 7.8891, lng: -72.5 }, 500, 'Taller 5B · UFPS', 'Ana.Pérez');
    const fila = URBIS_CURSO.filaDe(carga);
    const p = fila.descripcion.split('~~~');
    return { fila, campos: p.length, c0: p[0], c1: p[1], c2: p[2], c3: p[3],
             tieneTubo: fila.descripcion.indexOf(' | ') !== -1,
             tieneArroba: fila.descripcion.indexOf('@') !== -1 };
  }, DUELE);
  chk(f.campos === 5 && f.c0 === 'ana.prez',
      'el campo 0 es el autor en minúsculas: es donde el servidor busca al dueño');

  /* La firma del autor tiene que salir EXACTAMENTE igual que la del servidor.
     Su `normUser_` no quita las tildes: las BORRA, porque la ñ y las vocales
     acentuadas no están en su lista de caracteres permitidos. Quitarlas
     «bien» —pasando é a e— produce una firma que no coincide, el servidor
     niega la corrección por «no eres el autor», y cada vez que el grupo
     corrige se crea una fila nueva en vez de reescribir la suya. Sin un solo
     mensaje de error. Por eso se compara contra una copia literal de la
     función del servidor y no contra lo que uno espera que haga. */
  const NORM_SERVIDOR = v => String(v || '').trim().toLowerCase()
    .replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
  const nombres = ['Ana.Pérez', 'Peña Gómez', 'jesmen21s', 'María José', 'ÑOÑO', '  Dos  Espacios  '];
  const mios = await pg.evaluate(ns => ns.map(n => URBIS_CURSO.normUsuario(n)), nombres);
  const difieren = nombres.filter((n, i) => mios[i] !== NORM_SERVIDOR(n));
  chk(difieren.length === 0,
      'la firma del autor sale idéntica a la del servidor, tildes y ñ incluidas' +
      (difieren.length ? ' — difieren: ' + difieren.join(', ') : ' (' + nombres.length + ' nombres)'));
  chk(f.c1 === 'taller-5b-ufps', 'el campo 1 es la llave del curso');
  chk(f.c2 === '', 'el campo 2 —el único que un tercero puede reescribir— va vacío');
  chk(!f.tieneTubo && !f.tieneArroba,
      'ni « | » ni «@» sobreviven en la fila: son lo que el servidor corta y limpia por su cuenta');
  chk(Number(f.fila.lat).toFixed(4) === '7.8891' && Number(f.fila.lng).toFixed(4) === '-72.5000',
      'la fila lleva el centro del sector');

  // ── 3 · Ida y vuelta del texto ─────────────────────────────────────────
  const rt = await pg.evaluate((DUELE) => {
    const carga = URBIS_CURSO.armar(null, { general: DUELE }, { lat: 7.8891, lng: -72.5 }, 500, 'Taller 5B', 'Ana');
    const e = URBIS_CURSO.leerFila(URBIS_CURSO.filaDe(carga));
    return { texto: e.lecturas.general, autor: e.autor, curso: e.curso, escritas: e.escritas, ts: e.ts };
  }, DUELE);
  chk(rt.texto === DUELE,
      'lo que escribió el grupo vuelve carácter por carácter, con ~~~, tubo, correo, tildes y emoji');
  chk(rt.autor === 'ana' && rt.curso === 'taller-5b' && rt.escritas === 1,
      'y con él vuelven autor, curso y cuántas lecturas trae');
  chk(rt.ts === '2026-09-08T15:00:00.000Z', 'la entrega lleva la hora en que se hizo');

  // Una fila que no es una entrega no se lee como si lo fuera.
  const noEs = await pg.evaluate(() => [
    URBIS_CURSO.leerFila({ tipo: '🚨 Robo', descripcion: 'a | b | c' }),
    URBIS_CURSO.leerFila({ tipo: 'comentario', descripcion: 'ana~~~hola~~~~~~' }),
    URBIS_CURSO.leerFila(null)
  ].map(x => x === null));
  chk(noEs.every(Boolean), 'un reporte, un comentario normal y una fila vacía no son entregas');

  // ── 4 · Entregar ───────────────────────────────────────────────────────
  const e1 = await pg.evaluate(() => URBIS_CURSO.entregar(
    null, { general: 'Primera versión.' }, { lat: 7.8891, lng: -72.5 }, 500, 'Taller 5B'));
  const st1 = await pg.evaluate(() => ({ creadas: window.__escritas.length, filas: window.__filas.length }));
  chk(e1.ok && !e1.actualizada && st1.creadas === 1, 'la primera entrega crea la fila');

  const e2 = await pg.evaluate(() => URBIS_CURSO.entregar(
    null, { general: 'Segunda versión, corregida.' }, { lat: 7.8891, lng: -72.5 }, 500, 'Taller 5B'));
  const st2 = await pg.evaluate(() => ({ creadas: window.__escritas.length, filas: window.__filas.length }));
  chk(e2.ok && e2.actualizada && st2.creadas === 1 && st2.filas === 1,
      'corregir y volver a entregar REESCRIBE la fila: el profesor no recibe la misma entrega dos veces');

  // El grupo de al lado entrega lo suyo sobre el mismo sector.
  await pg.evaluate(() => { window.__yo = 'beto'; });
  const e3 = await pg.evaluate(() => URBIS_CURSO.entregar(
    null, { general: 'Lo del otro grupo.' }, { lat: 7.8891, lng: -72.5 }, 500, 'Taller 5B'));
  const st3 = await pg.evaluate(() => window.__filas.length);
  chk(e3.ok && st3 === 2, 'y el grupo de al lado entrega la suya sin pisar la primera');

  // ── 5 · Las negativas, con motivo ──────────────────────────────────────
  const neg = await pg.evaluate(async () => {
    const sin = await URBIS_CURSO.entregar(null, { general: 'x' }, { lat: 1, lng: 1 }, 500, '   ');
    window.__sesion = false;
    const sesion = await URBIS_CURSO.entregar(null, { general: 'x' }, { lat: 1, lng: 1 }, 500, 'Taller 5B');
    window.__sesion = true;
    const vacia = await URBIS_CURSO.entregar(null, { general: '   ' }, { lat: 1, lng: 1 }, 500, 'Taller 5B');
    const larga = await URBIS_CURSO.entregar(null,
      { general: 'corta', flujo: 'x'.repeat(40000) }, { lat: 1, lng: 1 }, 500, 'Taller 5B');
    return { sin, sesion, vacia, larga, filas: window.__filas.length };
  });
  chk(!neg.sin.ok && /nombre del curso/i.test(neg.sin.message), 'sin nombre de curso no se entrega, y lo dice');
  chk(!neg.sesion.ok && /sesión/i.test(neg.sesion.message), 'sin sesión iniciada tampoco, y lo dice');
  chk(!neg.vacia.ok && /nada escrito/i.test(neg.vacia.message), 'una entrega en blanco se rechaza antes de salir');
  chk(!neg.larga.ok && /Flujo|flujo/.test(neg.larga.message) && /acorten/i.test(neg.larga.message),
      'una entrega que no cabe se rechaza NOMBRANDO la lectura que hay que acortar');
  chk(neg.filas === 2, 'y ninguna de las cuatro negativas dejó basura en el servidor');

  // ── 6 · Recoger ────────────────────────────────────────────────────────
  const rec = await pg.evaluate(async () => {
    // Una entrega vieja del mismo grupo y sector, como la dejaría un servidor
    // que hubiera creado filas en vez de reescribirlas.
    const vieja = URBIS_CURSO.armar(null, { general: 'La de antier.' }, { lat: 7.8891, lng: -72.5 }, 500, 'Taller 5B', 'Ana.Pérez');
    vieja.ts = '2026-09-06T10:00:00.000Z';
    window.__filas.push(URBIS_CURSO.filaDe(vieja));
    // Y una de otro curso, que no debe aparecer.
    window.__filas.push(URBIS_CURSO.filaDe(
      URBIS_CURSO.armar(null, { general: 'Otro curso.' }, { lat: 7.8, lng: -72.5 }, 500, 'Taller 3A', 'caro')));
    const lista = await URBIS_CURSO.traer('taller 5b');
    return { n: lista.length, autores: lista.map(x => x.autor),
             primeroTexto: (lista.find(x => x.autor === 'ana.prez') || {}).lecturas };
  });
  chk(rec.n === 2, 'el curso recoge una entrega por grupo, no una por vez que entregaron');
  chk(rec.autores.indexOf('caro') === -1, 'y no se le cuela el trabajo de otro curso');
  chk(rec.primeroTexto && rec.primeroTexto.general === 'Segunda versión, corregida.',
      'de las dos del mismo grupo gana la más nueva');

  // ── 7 · El nombre del curso se recuerda ────────────────────────────────
  const mem = await pg.evaluate(() => {
    URBIS_CURSO.fijarCurso('  Taller 5B · UFPS  ');
    return { guardado: URBIS_CURSO.curso(), llave: URBIS_CURSO.normCurso(URBIS_CURSO.curso()) };
  });
  chk(mem.guardado === 'Taller 5B · UFPS' && mem.llave === 'taller-5b-ufps',
      'el nombre se guarda como lo escribieron y se busca por su llave');

  // ── 8 · El bloque en el panel ──────────────────────────────────────────
  await pg.addScriptTag({ path: REPO + '/js/64-analisis-edu.js' });
  await pg.addScriptTag({ path: REPO + '/js/65-analisis-edu-ui.js' });
  const ui = await pg.evaluate(() => {
    const e = { autor: 'ana.perez', titulo: 'La Libertad · radio 500 m', ms: Date.UTC(2026, 8, 8, 15, 0, 0),
                escritas: 2, lecturas: { general: 'Conclusión <b>del grupo</b>', flujo: 'Poca gente a pie.' },
                resumen: { leidos: 42, densidad: 3.5 } };
    const html = (window.URBIS_EDU_UI && window.URBIS_EDU_UI.entregaHTML) ? window.URBIS_EDU_UI.entregaHTML(e) : '';
    return { html, tieneAutor: html.indexOf('ana.perez') !== -1,
             escapa: html.indexOf('<b>del grupo</b>') === -1 && html.indexOf('&lt;b&gt;') !== -1,
             nombraLectura: html.indexOf('Conclusión del grupo') !== -1,
             cifra: html.indexOf('Puntos que entraron al análisis: 42') !== -1 };
  });
  chk(ui.tieneAutor && ui.nombraLectura,
      'la lista dice de quién es cada entrega y llama a cada lectura por su nombre');
  chk(ui.escapa, 'y el texto del grupo se escapa: nadie inyecta HTML en la pantalla del profesor');
  chk(ui.cifra, 'junto a lo escrito van las cifras que lo sostienen');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
