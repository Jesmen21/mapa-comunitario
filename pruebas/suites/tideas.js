const E = require('../entorno.js');
/* EL FODA DEL CURSO Y LAS IDEAS DE PROYECTO (js/64, js/65, js/63)

   El FODA lo escribe el motor, y el motor está escrito para quien va a poner
   plata: «mercado saturado», «competidores directos», «potencial de
   valorización». Los hallazgos sirven igual en un taller —seis locales de lo
   mismo en el radio es un dato urbano—, pero dichos así el estudiante o los
   copia sin entenderlos o los descarta enteros.

   Esta suite fija las dos mitades del arreglo:

   · el FODA se TRADUCE, y traducir significa cambiar el idioma y NADA más:
     mismos hallazgos, mismo número, mismo juicio. Un «traductor» que
     agregara, quitara o ablandara sería peor que el original;
   · y aparece lo que faltaba entre el diagnóstico y el tablero: encargos de
     proyecto, cada uno atado a UNA medida del propio análisis, con lo que
     hay que ir a comprobar antes de creerle. Sin la medida es una
     ocurrencia; sin el campo, una conclusión que el análisis no sostiene. */
const { chromium } = require(E.MODULOS + '/playwright-core');
const REPO = process.env.REPO || E.RAIZ;

// Las palabras de estudio de mercado que NO pueden sobrevivir en el curso.
const DE_NEGOCIO = ['competidores', 'Mercado saturado', 'Competencia instalada',
                    'demanda cautiva', 'potencial de valorización', 'tráfico peatonal',
                    'incertidumbre normativa', 'vacíos de oferta'];

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 500, height: 700 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  await pg.setContent('<div id="edu-analisis-salida"></div>');
  await pg.addScriptTag({ path: REPO + '/js/64-analisis-edu.js' });
  await pg.addScriptTag({ path: REPO + '/js/65-analisis-edu-ui.js' });

  // El FODA tal como lo devuelve el motor hoy, frase por frase.
  const FODA_MOTOR = {
    fortalezas: ['Corredor comercial consolidado (42% del uso): tráfico peatonal garantizado.'],
    debilidades: ['El sector no muestra atributos destacados en los datos abiertos disponibles: ' +
      'la ventaja del proyecto tendrá que construirse desde su propia propuesta, no desde el entorno.'],
    oportunidades: ['3 instituciones educativas cercanas: demanda cautiva de familias en horarios de entrada y salida.',
      'Sector en desarrollo (4 lotes en obra/baldíos): potencial de valorización a mediano plazo.'],
    riesgos: ['Mercado saturado: 7 competidores directos operando en el radio analizado.',
      'Alta proporción de lotes baldíos u obras (9): sector en transición con incertidumbre normativa.']
  };

  const hay = await pg.evaluate(() => !!(window.URBIS_EDU && window.URBIS_EDU.fodaEdu && window.URBIS_EDU.ideasDeDiseno));
  chk(hay, 'el módulo trae el FODA traducido y las ideas de proyecto');

  // ── 1 · Traducir es cambiar el idioma, no el contenido ─────────────────
  const tr = await pg.evaluate((F) => {
    const out = (window.URBIS_EDU.fodaEdu ? window.URBIS_EDU.fodaEdu(F) : F);
    const todo = ['fortalezas', 'debilidades', 'oportunidades', 'riesgos']
      .map(k => (out[k] || []).join(' ')).join(' ');
    const cuenta = k => (out[k] || []).length;
    return { todo, cuentas: [cuenta('fortalezas'), cuenta('debilidades'), cuenta('oportunidades'), cuenta('riesgos')] };
  }, FODA_MOTOR);

  const sobreviven = DE_NEGOCIO.filter(p => tr.todo.indexOf(p) !== -1);
  chk(sobreviven.length === 0,
      'ninguna palabra de estudio de mercado sobrevive' + (sobreviven.length ? ': ' + sobreviven.join(', ') : ''));
  chk(String(tr.cuentas) === String([1, 1, 2, 2]),
      'no se agrega ni se quita un solo hallazgo: los cuatro cuadrantes traen lo mismo que traían');
  // Los números son el hallazgo. Perderlos al traducir sería perder el FODA.
  ['42', '3', '4', '7', '9'].forEach(n => {
    chk(tr.todo.indexOf(n) !== -1, 'el número ' + n + ' del motor sigue en el texto del curso');
  });
  chk(/locales que hacen exactamente lo mismo/.test(tr.todo) && /Ya hay mucho de lo mismo/.test(tr.todo),
      'y «7 competidores directos» se dice como se le dice a un estudiante');
  // Traducir dos veces no debe deformar: es la prueba de que las reglas no se
  // pisan entre ellas (la más larga primero).
  /* Contra una versión que no tiene el traductor, la suite tiene que
     INFORMAR y no reventar: un fallo que se ve como una caída de node no
     dice cuál regla se perdió. */
  const doble = await pg.evaluate((F) => {
    if (!(window.URBIS_EDU && window.URBIS_EDU.fodaEdu)) return false;
    const a = window.URBIS_EDU.fodaEdu(F);
    const b = window.URBIS_EDU.fodaEdu(a);
    return JSON.stringify(a) === JSON.stringify(b);
  }, FODA_MOTOR);
  chk(doble, 'traducir un texto ya traducido no lo cambia otra vez');

  // Un FODA vacío o ausente no revienta ni se inventa nada.
  const vacio = await pg.evaluate(() => {
    if (!(window.URBIS_EDU && window.URBIS_EDU.fodaEdu)) return false;
    const a = window.URBIS_EDU.fodaEdu(null);
    return Object.keys(a).length === 4 && a.fortalezas.length === 0;
  });
  chk(vacio, 'sin FODA del motor, el traducido sale vacío y no inventado');

  // ── 2 · Las ideas salen de una medida ──────────────────────────────────
  const R = {
    edu: { leidos: 60 },
    stats: { porSub: { baldio_obra: 4 }, usoPredominante: { residencial: 78, comercial: 12 },
             movilidad: { flujo: { franjas: { manana: 80, tarde: 60, noche: 20 } } } },
    contexto: {
      paradas: 0,
      caminata: { hastaM: 1500, parque: null, salud: { min: 22, distM: 1600 }, colegio: { min: 6, distM: 430 },
                  cuantos: { colegio: 2, salud: 1, parque: 0 } },
      espacioPublico: { m2PorHab: 1.2, meta: 10, pctDeMeta: 12, habitantes: 5000, n: 1, m2: 6000 },
      terreno: { pendientePct: 18, grado: 'fuerte', desnivelM: 65, cae: 'el suroriente', haciaElAgua: true },
      agua: { cercano: { nombre: 'la quebrada Seca', distM: 180, rumbo: 'el suroriente' } }
    }
  };
  const id = await pg.evaluate((R) => {
    if (!(window.URBIS_EDU && window.URBIS_EDU.ideasDeDiseno)) return { ids: [], lista: [], esperando: -1, pocos: false, nota: '' };
    const d = window.URBIS_EDU.ideasDeDiseno(R);
    return { ids: d.lista.map(x => x.id), lista: d.lista, esperando: d.esperandoContexto, pocos: d.pocosPuntos, nota: d.nota };
  }, R);

  ['parque', 'ep', 'baldios', 'noche', 'pendiente', 'agua', 'equipamiento', 'monouso', 'llegar']
    .forEach(k => chk(id.ids.indexOf(k) !== -1, 'sale la idea de «' + k + '», que este sector sí pide'));
  chk(id.lista.length > 0 && id.lista.every(x => x.porque && x.disena && x.campo),
      'toda idea trae las tres partes: la medida, el encargo y qué ir a comprobar');
  const conNumero = id.lista.filter(x => /\d/.test(x.porque));
  chk(id.lista.length > 0 && conNumero.length === id.lista.length,
      'y la medida de cada una lleva su número: sin número es una ocurrencia');
  chk(/no qué hay que construir/.test(id.nota),
      'la nota dice que son encargos para discutir, no una respuesta');

  // Las cuentas se hacen bien: el déficit de espacio público en m² absolutos.
  const ep = id.lista.find(x => x.id === 'ep');
  chk(ep && ep.disena.indexOf('44.000') !== -1,
      'el déficit de espacio público se dice en metros cuadrados, calculado ((10 − 1,2) × 5.000)');
  const agua = id.lista.find(x => x.id === 'agua');
  chk(agua && agua.porque.indexOf('la quebrada Seca') !== -1 && agua.porque.indexOf('180') !== -1,
      'la idea del agua nombra el cauce y su distancia, no «un cuerpo de agua»');

  // ── 3 · Lo que no se ha medido no se afirma ────────────────────────────
  const sinCtx = await pg.evaluate(() => {
    if (!(window.URBIS_EDU && window.URBIS_EDU.ideasDeDiseno)) return { n: 0, esperando: 0, pocos: false };
    const d = window.URBIS_EDU.ideasDeDiseno({ edu: { leidos: 8 }, stats: { porSub: {}, usoPredominante: {}, movilidad: {} } });
    return { n: d.lista.length, esperando: d.esperandoContexto, pocos: d.pocosPuntos };
  });
  chk(sinCtx.esperando > 0,
      'sin el contexto consultado se DICE cuántas ideas están esperándolo, en vez de esconderlas');
  chk(sinCtx.pocos,
      'y con pocos puntos se avisa de que el silencio no es ausencia de carencias');
  chk(id.esperando === 0 && id.lista.length > 0, 'con el contexto ya consultado no queda ninguna esperando');

  // ── 4 · En pantalla ────────────────────────────────────────────────────
  const ui = await pg.evaluate((R) => {
    const html = (window.URBIS_EDU_UI && window.URBIS_EDU_UI.bloqueIdeas) ? window.URBIS_EDU_UI.bloqueIdeas(R) : '';
    return { html, tieneCampo: html.indexOf('👟 Antes de creerle') !== -1,
             tieneMedida: html.indexOf('65 m de desnivel') !== -1,
             n: (html.match(/<li>/g) || []).length };
  }, R);
  chk(ui.n === 9 && ui.tieneCampo && ui.tieneMedida,
      'el bloque de pantalla pinta las nueve ideas con su medida y su trabajo de campo');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
