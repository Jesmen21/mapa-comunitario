const E = require('../entorno.js');
/* EDITAR UN REPORTE YA NO BORRA CASILLAS (v837)
   ────────────────────────────────────────────────────────────────────────
   Al editar, el guardado conservaba una LISTA de casillas del registro. Esa
   forma de escribirlo tenía el fallo al revés: la casilla que nadie se
   acordara de meter en la lista se BORRABA, en silencio, la primera vez que
   su dueño editara el reporte.

   No era hipotético. Cuando se escribió esto se estaban perdiendo ya dos:
     · el HORARIO del letrero (v815, casilla 66) — un dato levantado en la
       calle, que desaparecía si alguien editaba el punto desde el teléfono;
     · la PETICIÓN DE CORRECCIÓN de un moderador (v835, casilla 67), que es
       la peor de las dos: a la persona se le pide que corrija y edite, y
       editar borraba justo la petición. La función se rompía a sí misma en
       su camino principal.

   La regla, dicha al derecho: el formulario manda en las casillas QUE
   ESCRIBIÓ, y en las demás manda lo que ya había. Olvidar una casilla nueva
   pasa de destruir un dato a conservarlo de más —visible y arreglable—, que
   es el lado bueno donde equivocarse.

   Esta suite comprueba la regla sobre la función de verdad, y además que
   `guardarPunto` la use en vez de llevar su propia copia. Y la última
   comprobación es la que importa a futuro: TODA casilla del mapa de
   posiciones sobrevive a una edición que no la pregunta — incluidas las que
   alguien añada después de escribir esto, sin tener que acordarse de nada. */
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

  chk(await pg.evaluate(() => typeof window.urbisFusionarEdicion === 'function'),
      'la regla de qué sobrevive a una edición tiene nombre propio y se puede comprobar');

  // ── La regla, sobre la función de verdad ───────────────────────────────
  const r = await pg.evaluate(() => {
    if (typeof window.urbisFusionarEdicion !== 'function') return null;
    const viejo = ['cat', 'titulo viejo', 'nota vieja', 'Malo', 'guardado', 'x'];
    const nuevo = ['cat', 'titulo NUEVO', 'nota NUEVA', 'Bueno', '', ''];
    const sale = window.urbisFusionarEdicion(viejo, nuevo, new Set([1, 2, 3]));
    return { sale };
  });
  chk(!!r && r.sale[1] === 'titulo NUEVO' && r.sale[2] === 'nota NUEVA' && r.sale[3] === 'Bueno',
      'lo que el formulario escribió, manda');
  chk(!!r && r.sale[4] === 'guardado' && r.sale[5] === 'x',
      'y lo que no preguntó se queda como estaba, en vez de vaciarse');

  // Una fila nueva más larga que la vieja, y al revés: ninguna de las dos
  // puede perder cola.
  const largos = await pg.evaluate(() => {
    const f = window.urbisFusionarEdicion;
    // Devuelve el vacío si la pieza aún no existe: así esta suite se puede
    // correr contra la versión anterior y LEER qué falta.
    if (typeof f !== 'function') return { viejaMasLarga: '(no existe)', nuevaMasLarga: '(no existe)' };
    return {
      viejaMasLarga: f(['a', 'b', 'c', 'd'], ['A'], new Set([0])).join('|'),
      nuevaMasLarga: f(['a'], ['A', 'B', 'C'], new Set([0, 1, 2])).join('|')
    };
  });
  chk(largos.viejaMasLarga === 'A|b|c|d',
      'una fila vieja más larga no pierde su cola (' + largos.viejaMasLarga + ')');
  chk(largos.nuevaMasLarga === 'A|B|C',
      'y una fila nueva más larga tampoco (' + largos.nuevaMasLarga + ')');

  // ── Lo que se estaba perdiendo de verdad ──────────────────────────────
  /* Se arma una fila con TODAS las casillas del mapa de posiciones llenas y
     se simula la edición de un reporte ciudadano normal, que solo escribe
     la cabecera. Ninguna casilla del final puede quedarse en blanco. */
  const supervivencia = await pg.evaluate(() => {
    if (typeof window.urbisFusionarEdicion !== 'function') return null;
    const S = window.URBIS_SLOTS || {};
    const nombres = Object.keys(S);
    const tope = Math.max.apply(null, nombres.map(k => S[k]));
    const viejo = new Array(tope + 1).fill('');
    for (let i = 0; i <= BASE_OFFSET + 7; i++) viejo[i] = 'cab' + i;
    nombres.forEach(k => { viejo[S[k]] = 'valor-de-' + k; });
    // El formulario ciudadano: escribe la cabecera y nada más.
    const escritas = new Set();
    for (let i = 0; i <= BASE_OFFSET + 7; i++) escritas.add(i);
    const nuevo = new Array(BASE_OFFSET + 8).fill('');
    for (let i = 0; i <= BASE_OFFSET + 7; i++) nuevo[i] = 'NUEVO' + i;
    const sale = window.urbisFusionarEdicion(viejo, nuevo, escritas);
    const perdidas = nombres.filter(k => sale[S[k]] !== 'valor-de-' + k);
    return { total: nombres.length, perdidas, cabezaNueva: sale[1] === 'NUEVO1' };
  });
  chk(!!supervivencia && supervivencia.cabezaNueva,
      'al editar, lo que la persona acaba de escribir entra');
  chk(!!supervivencia && supervivencia.perdidas.length === 0,
      'y NINGUNA de las ' + (supervivencia ? supervivencia.total : '?') +
      ' casillas del registro se pierde' +
      (supervivencia && supervivencia.perdidas.length ? ': ' + supervivencia.perdidas.join(', ') : ''));

  // Las dos que se estaban perdiendo, nombradas, para que se lea en el rojo
  // exactamente qué se rompió si alguien vuelve atrás.
  const dos = await pg.evaluate(() => {
    const S = window.URBIS_SLOTS || {};
    return { horario: S.edificioHorario, correccion: S.correccionPedida };
  });
  chk(!!(supervivencia && supervivencia.perdidas.indexOf('edificioHorario') === -1),
      'el horario del letrero sobrevive a la edición (casilla ' + dos.horario + ', se perdía desde la v815)');
  chk(!!(supervivencia && supervivencia.perdidas.indexOf('correccionPedida') === -1),
      'y la petición de corrección también (casilla ' + dos.correccion +
      '): se le pide a alguien que corrija y edite, y editar la borraba');

  // ── Lo que el formulario SÍ tiene que poder cambiar ───────────────────
  /* La regla nueva no puede volverse un candado. Tres casos que deben
     seguir mandando desde el formulario. */
  const mandaForm = await pg.evaluate(() => {
    const f = window.urbisFusionarEdicion, S = window.URBIS_SLOTS || {};
    if (typeof f !== 'function') return { pisos: '(no existe)', material: '(no existe)', victimas: '(no existe)' };
    const viejo = new Array(S.edificioUsosPorPiso + 1).fill('');
    viejo[S.edificioPisos] = '3'; viejo[S.edificioMaterialidad] = 'ladrillo'; viejo[S.victimas] = '1;0';
    const nuevo = viejo.slice();
    nuevo[S.edificioPisos] = '7';            // Pro City sí pregunta los pisos
    nuevo[S.edificioMaterialidad] = '';      // pero NO la materialidad
    nuevo[S.victimas] = '2;1';               // la pregunta estaba en pantalla
    const sale = f(viejo, nuevo, new Set([S.edificioPisos, S.victimas]));
    return { pisos: sale[S.edificioPisos], material: sale[S.edificioMaterialidad], victimas: sale[S.victimas] };
  });
  chk(mandaForm.pisos === '7', 'lo que el formulario de Pro City sí pregunta se actualiza (pisos)');
  chk(mandaForm.material === 'ladrillo',
      'y lo que no pregunta se conserva: editar en Pro City no borra la materialidad levantada en la calle');
  chk(mandaForm.victimas === '2;1',
      'las víctimas se actualizan cuando la pregunta estaba en pantalla');

  // ── Y que el guardado use ESTA regla, no una copia suya ───────────────
  const j12 = fs.readFileSync(REPO + '/js/12-spa-ui.js', 'utf8');
  chk(/urbisFusionarEdicion\(/.test(j12),
      'el guardado usa esta misma regla y no lleva su propia copia');
  /* La lista vieja no puede seguir por ahí: dos criterios para lo mismo es
     cómo se llegó al defecto. */
  chk(!/const conservar = \[base/.test(j12),
      'y la lista de «qué conservar» ya no existe: era ella la que borraba lo que no estuviera nombrado');
  /* La cabecera del reporte llega hasta BASE_OFFSET+7 (el barrio). Si
     alguien alarga la fila del formulario sin mover este número, lo nuevo
     se conservaría del registro viejo en vez de guardarse. */
  chk(/i <= BASE_OFFSET \+ 7; i\+\+\) escribeElFormulario\.add\(i\)/.test(j12),
      'la cabecera que el formulario escribe está dicha con el mapa de posiciones, no con un número suelto');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
