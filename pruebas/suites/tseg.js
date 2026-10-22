const E = require('../entorno.js');
// El seguimiento presidencial es una linea de tiempo documentada: cada entrada
// debe tener fuente verificable y las URLs deben ser reales y http(s).
const { chromium } = require(E.MODULOS + '/playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const REPO = process.env.REPO || E.RAIZ;
const TIPOS = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
                '.json':'application/json', '.png':'image/png' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const f = path.join(REPO, rel);
  if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  // ── Revisión del dato, antes de mirar la pantalla ────────────────────
  const d = JSON.parse(fs.readFileSync(REPO + '/assets/data/seguimiento-presidencial.json', 'utf8'));
  const nueva = d.entradas.find(e => e.id === "deroga-11-circulares-laborales-gobierno-2026-08-20");
  chk(!!nueva, 'la entrada de las circulares está en el JSON');
  if (nueva) {
    chk(nueva.fecha === '2026-08-20', 'lleva la fecha de la resolución, no la del rebote en prensa');
    chk((nueva.fuentes || []).length >= 4, 'trae varias fuentes (' + (nueva.fuentes||[]).length + ')');
    chk(!!nueva.contrapunto, 'trae contrapunto');
    // Lo esencial: la entrada NO puede afirmar lo que afirma el video viral.
    chk(/no crea ni elimina|conserva el derecho/.test(nueva.contrapunto),
        'aclara que el derecho al pago sobrevive a la derogatoria');
    chk(!/pierden sus horas extras|les tumbaron las extras/i.test(nueva.detalle),
        'el detalle no repite el titular viral como si fuera un hecho');
    chk(/Resolución 2708/.test(nueva.detalle) && /Circular 0040/.test(nueva.detalle),
        'nombra la norma concreta: Resolución 2708 y Circular 0040');
    // Segundo bulo sobre la MISMA resolución: la protección a trabajadores
    // con discapacidad. Debe estar cubierto en la misma entrada.
    chk(/Circular Interna 0049/.test(nueva.detalle),
        'cubre también la circular de estabilidad reforzada (0049)');
    chk(/Ley 361 de 1997/.test(nueva.contrapunto),
        'y cita la ley que sostiene esa protección (Ley 361 de 1997)');
    chk(!/elimin[oó] la protección laboral/i.test(nueva.detalle),
        'el detalle no repite el titular de "eliminó la protección"');
    // Que el vacío real quede dicho, no solo el desmentido.
    chk(/sin reemplazo|guía operativa/.test(nueva.contrapunto),
        'dice qué se pierde de verdad, no solo lo que NO se pierde');
  }

  /* ── Segundo caso: la fundación de la primera dama ──────────────────────
     SE ANCLA POR `id` Y NO POR TÍTULO (v1141). Con el patrón de título esta
     búsqueda se rompió en silencio: el 22 de septiembre entró OTRA entrada
     —«Dos juzgados ordenan a Presidencia y a la fundación de la primera dama
     informar cuánto recaudaron»— cuyo título contiene la misma frase y que
     va ANTES en el arreglo, así que `find` devolvía esa y las cinco
     aserciones de abajo medían la entrada equivocada. No hizo falta ningún
     retitulado: bastó que el registro creciera. Es la clase B, y la regla
     está escrita en CLAUDE.md desde la v1127: el ancla es por `id` y nunca
     por título. */
  const fund = d.entradas.find(e => e.id === 'fundacion-primera-dama-canales-donacion-2026-08-20');
  chk(!!fund, 'la entrada de la fundación está en el JSON, anclada por id');
  if (fund) {
    chk(fund.tipoFuente === 'disputado',
        'va marcada como disputado, no como hecho cerrado (es "' + fund.tipoFuente + '")');
    chk(!!fund.contrapunto, 'trae contrapunto');
    // Lo esencial: no puede afirmar el "desvío" que afirma el video viral.
    chk(!/desv[ií]a los dineros|desvío de fondos/i.test(fund.detalle),
        'el detalle no repite la acusación de desvío como si fuera un hecho probado');
    chk(/NO demuestra|no demuestra/i.test(fund.contrapunto),
        'aclara que la propia investigación no prueba la irregularidad');
    chk(/conflicto de interés/i.test(fund.contrapunto),
        'nombra el problema real: conflicto de interés estructural');
    chk(/Cuestión Pública/.test(fund.detalle) || /Cuestión Pública/.test((fund.fuentes||[]).map(x=>x.n).join(' ')),
        'cita la fuente que destapó el caso');
    chk((fund.fuentes || []).some(x => /Petro/.test(fund.contrapunto)) || /Petro/.test(fund.contrapunto),
        'recoge también la crítica de Petro');
  }

  // ── Tercer caso: el Bloque de Defensa para la Seguridad Urbana ────────
  const bloq = d.entradas.find(e => e.id === "anuncia-bloque-defensa-seguridad-urbana-2026-07-05");
  chk(!!bloq, 'la entrada del Bloque de Seguridad Urbana está en el JSON');
  if (bloq) {
    chk(bloq.tipoFuente === 'disputado',
        'va marcada como disputado (es "' + bloq.tipoFuente + '")');
    chk(!!bloq.contrapunto, 'trae contrapunto');
    // No se puede afirmar que arma civiles: eso NO está confirmado.
    chk(!/arma(rá|rán)? a civiles|creó grupos armados/i.test(bloq.detalle),
        'el detalle no afirma que arme civiles como hecho consumado');
    chk(/22A/.test(bloq.contrapunto),
        'cita el artículo constitucional concreto (22A)');
    chk(/Cepeda|Convivir/.test(bloq.contrapunto),
        'nombra la crítica de actores políticos colombianos reales, no solo del medio');
    chk(/Char|respaldaron/i.test(bloq.contrapunto),
        'recoge también el respaldo de alcaldes');
    // Transparencia sobre la fuente que motivó la búsqueda: se identifica su
    // línea editorial en vez de presentarla como neutral.
    chk(/Pablo Iglesias|línea editorial/i.test(bloq.contrapunto),
        'identifica la línea editorial del medio que planteó la tesis de "paramilitarismo 2.0"');
    // Honestidad sobre lo que no se pudo confirmar.
    chk(/No hay confirmación pública/i.test(bloq.detalle),
        'admite que no hay confirmación pública de que el decreto se firmara con contenido definido');
  }

  // ── Las firmas con que se inscribió la candidatura ───────────────────
  // Es el asunto donde más fácil se resbala un módulo así: el titular viral
  // dice "firmas falsas" y la Registraduría dijo otra cosa. La entrada tiene
  // que sostener las dos mitades o no sirve.
  const firmas = d.entradas.find(e => e.id === "registraduria-invalido-61-5-08-2026-02-11");
  chk(!!firmas, 'la entrada de las firmas está en el JSON');
  if (firmas) {
    chk(firmas.tipoFuente === 'disputado',
        'va marcada como disputada, no como hecho cerrado (es "' + firmas.tipoFuente + '")');
    chk(/5\.079\.000/.test(firmas.detalle) && /1\.978\.108/.test(firmas.detalle),
        'da las dos cifras concretas: presentadas y validadas');
    chk(/1\.437\.677/.test(firmas.detalle) && /273\.211/.test(firmas.detalle),
        'y desglosa por qué se cayeron, en vez de dejar un porcentaje suelto');
    // La distinción que decide todo el asunto.
    chk(/Invalidada no es lo mismo que falsa/i.test(firmas.contrapunto),
        'separa "invalidada" de "falsa", que no son lo mismo');
    chk(/Henry Humberto Martínez|Alexander Francisco Henao/.test(firmas.contrapunto),
        'dice dónde SÍ halló indicios de fraude la Registraduría: en otros dos comités');
    chk(/635\.216/.test(firmas.contrapunto),
        'recuerda el umbral legal, que los apoyos válidos superaban de sobra');
    chk(!/firmas falsas/i.test(firmas.titulo),
        'el título no da por probado lo que la Registraduría descartó');
    chk(/no tiene ni pies ni cabeza|sostuvo que/i.test(firmas.contrapunto),
        'recoge la defensa del propio implicado');
  }

  // ── Las demandas contra la elección ──────────────────────────────────
  const nulidad = d.entradas.find(e => e.id === "consejo-estado-admite-demanda-nulidad-2026-08-04");
  chk(!!nulidad, 'la entrada de las demandas de nulidad está en el JSON');
  if (nulidad) {
    chk(nulidad.tipoFuente === 'disputado', 'también va marcada como disputada');
    chk((nulidad.fuentes || []).length >= 5,
        'trae varias fuentes (' + (nulidad.fuentes || []).length + ')');
    // Lo que separa una cronología de un panfleto: decir en qué quedó.
    chk(/no revocó/.test(nulidad.contrapunto),
        'dice que el CNE no revocó la candidatura');
    chk(/reparo de forma|no una decisión de fondo/i.test(nulidad.contrapunto),
        'explica que una inadmisión es un reparo de forma, no una decisión de fondo');
    chk(/se posesionó el 7 de agosto/i.test(nulidad.contrapunto),
        'y que la posesión ocurrió, que es el desenlace comprobable');
    chk(/ColombiaCheck|MalaEspina/.test(nulidad.contrapunto),
        'cita a los verificadores que desmintieron el bulo de que no podía posesionarse');
    chk(/no acusa fraude en el conteo/i.test(nulidad.contrapunto),
        'aclara que la demanda divulgada por Petro no acusa fraude en el conteo de votos');
  }

  // Las dos entradas cuelgan de la misma categoría: es un hilo, no dos
  // rumores sueltos, y así se puede seguir completo desde el filtro.
  /* Cuentan que sean DOS o más, no exactamente dos: el hilo crece con los
     meses y una cifra exacta convierte cada entrada nueva en un fallo falso.
     Lo que se comprueba es la intención: que cuelguen de la misma categoría. */
  const legit = d.entradas.filter(e => e.categoria === 'legitimidad');
  chk(legit.length >= 2,
      'van todas bajo "Legitimidad electoral" (' + legit.length + ')');
  chk(!!(d.categorias || {}).legitimidad,
      'y la categoría existe en el catálogo, con nombre e icono propios');

  // Un mismo acto de gobierno no puede figurar como dos hechos distintos:
  // en una línea de tiempo eso duplica la gravedad de lo ocurrido.
  const porResolucion = d.entradas.filter(e =>
    /Resolución 2708/.test((e.detalle || '') + (e.titulo || '')));
  chk(porResolucion.length === 1,
      'la Resolución 2708 figura una sola vez (' + porResolucion.length + ')');

  // Regla del archivo: toda entrada con fuente verificable, y sin URLs raras.
  const malas = [];
  d.entradas.forEach(e => {
    const us = (e.fuentes || []).map(f => f.u).concat(e.url ? [e.url] : []);
    us.forEach(u => { if (!/^https?:\/\//i.test(u)) malas.push(e.titulo + ' → ' + u); });
    if (!us.length) malas.push(e.titulo + ' → sin fuente');
  });
  chk(malas.length === 0, 'todas las entradas tienen fuente http(s)' +
      (malas.length ? ': ' + malas.slice(0, 3).join(' | ') : ''));

  const cats = new Set(Object.keys(d.categorias));
  const huerfanas = d.entradas.filter(e => !cats.has(e.categoria)).map(e => e.categoria);
  chk(huerfanas.length === 0, 'ninguna entrada apunta a una categoría inexistente' +
      (huerfanas.length ? ': ' + huerfanas.join(', ') : ''));

  // No confundir las dos cosas de "11" que pasaron la misma semana.
  const nombram = d.entradas.find(e => e.id === "firma-11-decretos-nombramientos-dnp-2026-08-21");
  chk(!!nombram && nombram.titulo !== (nueva && nueva.titulo),
      'no se confunde con los 11 decretos de nombramientos del 21 de agosto');

  // ── Servicios públicos y bolsillo ────────────────────────────────────
  // Lo que la gente siente primero es el recibo, y es también donde más
  // rápido se deforma un dato: «subió la luz» y «hay un cobro nuevo si te
  // pasas de tu meta» no son lo mismo, y el registro no puede dejar que se
  // confundan — sería publicar el bulo con el sello de URBIS encima.
  chk(!!(d.categorias || {}).servicios, 'existe la categoría de servicios públicos y bolsillo');
  const luz = d.entradas.find(e => e.id === "arranca-programa-ahorro-creg-este-2026-09-01");
  chk(!!luz, 'está la entrada del recargo en el recibo de la luz');
  if (luz) {
    chk(luz.categoria === 'servicios', 'va en servicios públicos (' + luz.categoria + ')');
    chk(/101 120/.test(luz.detalle) && /101 126/.test(luz.detalle),
        'nombra las dos resoluciones: la que crea el programa y la que corrió la fecha');
    chk(/30 %/.test(luz.detalle) && /50 %/.test(luz.detalle) && /70 %/.test(luz.detalle),
        'trae los tres porcentajes de recargo por estrato');
    chk(/10 %/.test(luz.detalle) && /por encima/.test(luz.detalle),
        'dice que el recargo va SOLO sobre lo que pase del margen, no sobre todo el consumo');
    // Lo esencial: no repetir el titular que circula.
    chk(/NO es un alza general de la tarifa/i.test(luz.contrapunto || ''),
        'aclara que no es un alza general de la tarifa');
    chk(/reconocimiento|premiar/i.test(luz.detalle),
        'y que la otra mitad del programa es el reconocimiento a quien ahorre');
    chk((luz.fuentes || []).some(f => /creg\.gov\.co/.test(f.u)),
        'cita el texto oficial de la resolución, no solo la prensa');
  }
  const gas = d.entradas.find(e => e.id === "gobierno-congela-precio-gasolina-acpm-2026-08-29");
  chk(!!gas, 'está la entrada del congelamiento de la gasolina');
  if (gas) {
    chk(/Congelar no es bajar/i.test(gas.contrapunto || ''),
        'dice que congelar no es bajar');
    chk(/FEPC|Fondo de Estabilización/.test(gas.contrapunto || ''),
        'y nombra quién absorbe el diferencial (el FEPC)');
    chk(/Cúcuta/.test(gas.detalle), 'aterriza el dato en Cúcuta, que es de donde es quien lee');
  }

  // ── Desinformación y discurso público ────────────────────────────────
  // La sección más delicada del módulo: acá se registra lo que unos dicen de
  // otros. La regla es la de siempre y se comprueba entrada por entrada — una
  // acusación se publica COMO acusación, con lo que la sostiene y con lo que
  // la contradice.
  chk(!!(d.categorias || {}).informacion, 'existe la categoría de desinformación y discurso público');
  const bots = d.entradas.find(e => e.id === "petro-pide-investigar-penalmente-red-2026-08-27");
  chk(!!bots, 'está la denuncia de la red de bots');
  if (bots) {
    chk(bots.tipoFuente === 'declaracion',
        'va como declaración, no como hecho probado (es "' + bots.tipoFuente + '")');
    chk(/no ha presentado públicamente la evidencia/i.test(bots.contrapunto || ''),
        'el contrapunto dice que la evidencia no se ha presentado');
    chk(/Misión de Observación Electoral de la Unión Europea/.test(bots.contrapunto || ''),
        'y confronta la denuncia con el informe de los observadores');
    chk(!/alteró las elecciones\.|manipuló a los votantes\./.test(bots.detalle || ''),
        'el detalle no da por probada la manipulación');
    chk(/según él|sostiene que|afirma que/i.test(bots.detalle + bots.titulo),
        'y atribuye la afirmación a quien la hace');
  }
  const moe = d.entradas.find(e => e.id === "mision-electoral-union-europea-avala-2026-09-03");
  chk(!!moe, 'está el informe de la misión electoral europea');
  if (moe) {
    // Media verdad en las dos direcciones: el informe sirve para dos cosas
    // opuestas y publicar solo la mitad que conviene sería el error.
    chk(/voto fusil/i.test(moe.detalle) && /desinformación aumentó/i.test(moe.detalle),
        'trae las dos mitades: descarta el voto fusil Y dice que la desinformación creció');
    chk(/15 recomendaciones/.test(moe.detalle), 'y las recomendaciones que dejó');
    chk(/Ninguna de las dos mitades cancela a la otra/i.test(moe.contrapunto || ''),
        'y avisa de que no se puede citar solo la mitad que conviene');
  }
  const destripar = d.entradas.find(e => e.id === "destripar-izquierda-explica-frase-hizo-2026-02-11");
  chk(!!destripar, 'está la frase de campaña sobre «destripar»');
  if (destripar) {
    // Publicar la frase sin su aclaración sería descontextualizar a propósito.
    chk(/no deben tomarse literalmente|no hay que tomarla literal|recursos que da la ley/i.test(destripar.detalle),
        'incluye su propia aclaración, no solo la frase');
    chk(/no se afirma que la frase sea un llamado a la violencia/i.test(destripar.contrapunto || ''),
        'y dice expresamente que el registro no afirma que sea un llamado a la violencia');
    chk(/Petro/.test(destripar.detalle), 'recoge también que la respuesta usó la misma palabra');
  }

  // ── La comparación de incautaciones ──────────────────────────────────
  // Una comparación de cifras entre dos gobiernos es donde más fácil se
  // miente sin decir una sola mentira: basta elegir el periodo, la unidad y
  // la línea de base que convienen. Acá se comprueba que estén los tres
  // reparos, porque sin ellos el registro estaría amplificando una cuenta
  // que no se sostiene — venga de quien venga.
  const coca = d.entradas.find(e => e.id === "petro-dice-desplomo-incautacion-cocaina-2026-09-01");
  chk(!!coca, 'está la comparación de incautaciones de cocaína');
  if (coca) {
    chk(coca.tipoFuente === 'disputado',
        'va como disputado: son dos versiones y nadie las ha dirimido (es "' + coca.tipoFuente + '")');
    // Las dos orillas, con número.
    chk(/20 mil kilos/.test(coca.detalle) && /12 mil kilos/.test(coca.detalle) &&
        /4\.687/.test(coca.detalle),
        'trae las cifras del gobierno actual, incluida la de una sola operación');
    chk(/746/.test(coca.detalle) && /889/.test(coca.detalle) && /3\.000/.test(coca.detalle),
        'y las del gobierno anterior, con años completos');
    // Los tres reparos.
    chk(/DROGA/.test(coca.contrapunto || '') && /COCAÍNA/.test(coca.contrapunto || ''),
        'advierte que el balance dice droga y el trino dice cocaína');
    chk(/24 días/.test(coca.contrapunto || '') && /Tres semanas no son una tendencia/.test(coca.contrapunto || ''),
        'advierte que no se puede extrapolar tres semanas a un año');
    chk(/1\.000 toneladas por año no aparecen en ningún registro público/.test(coca.contrapunto || ''),
        'y corrige la línea de base: las 1.000 toneladas no están documentadas');
    // Y lo que es justo para el otro lado: la dirección sí se sostiene.
    chk(/la dirección que señala sí se sostiene/i.test(coca.contrapunto || ''),
        'pero reconoce que la dirección de la caída sí se sostiene con los datos');
    chk(/La Silla Vacía/.test(coca.contrapunto || '') &&
        (coca.fuentes || []).some(f => /lasillavacia/.test(f.u)),
        'y cita al verificador que ya había calificado esa cifra');
    chk(!/se desplomó la incautación\./i.test(coca.detalle || '') ||
        /respondió en X|trino/i.test(coca.detalle || ''),
        'la frase del desplome va atribuida a quien la dijo, no como conclusión propia');
  }
  const serieCoca = (d.indicadores || {}).cocaina;
  chk(!!serieCoca, 'y la serie de cocaína incautada por año está en indicadores');
  if (serieCoca) {
    // Mezclar un año completo con tres semanas en la misma gráfica sería
    // dibujar la mentira que el contrapunto acaba de desmontar.
    chk((serieCoca.puntos || []).every(x => /-12-31$/.test(x.f)),
        'solo lleva años cerrados, para comparar entre iguales');
    chk(/no tiene un año cerrado/.test(serieCoca.leyenda || ''),
        'y dice por qué el gobierno actual todavía no aparece');
    chk(serieCoca.sentido === 'neutro' && /no es automáticamente mejor política/.test(serieCoca.leyenda || ''),
        'y avisa de que más toneladas no es automáticamente mejor política');
  }

  // ── El tema de fondo del clima político ──────────────────────────────
  const clima = (d.transversales || []).find(t => /clima político/i.test(t.titulo));
  chk(!!clima, 'está el tema de fondo sobre el clima político');
  if (clima) {
    chk(/DOCUMENTADO/.test(clima.detalle) && /NO DOCUMENTADO/.test(clima.detalle) &&
        /NO SE PUEDE AFIRMAR/.test(clima.detalle),
        'separa lo documentado, lo no documentado y lo que no se puede afirmar');
    chk(/en las dos direcciones/i.test(clima.detalle),
        'y advierte de los medios con línea declarada en las DOS orillas, no en una');
    chk(/no cita a un medio de opinión como prueba/i.test(clima.detalle),
        'deja escrito que un medio de opinión no es prueba de un hecho');
  }

  // ── Y que se vea ─────────────────────────────────────────────────────
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const b = await chromium.launch({ executablePath: E.CHROMIUM });
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(e.message));
  await pg.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    return route.fulfill({ status: 200, body: '' });
  });
  await pg.goto(base + '/seguimiento.html', { waitUntil:'load' });
  await pg.waitForTimeout(900);

  const vista = await pg.evaluate(() => {
    const txt = document.body.innerText;
    return { pinta: txt.length > 400,
             tieneCirculares: /circulares/i.test(txt),
             titulo: (document.querySelector('h1, .sp-titulo') || {}).textContent || '' };
  });
  chk(vista.pinta, 'la página del seguimiento carga y pinta contenido');

  /* ── LA PORTADA, CONTRATO DE LA v1143 ────────────────────────────────
     Hasta la v1142 esto medía otro orden —ficha · gráficos · enlace · muro—
     y la v1143 lo cambió entero por decisión de quien firma el módulo: la
     portada es SOLO GRÁFICOS. La prueba no se afloja, se hace MÁS PRECISA:
     antes comprobaba un orden de cuatro piezas, ahora comprueba que no haya
     ninguna pieza de más y nombra las tres que se quedan con su razón.

     Y LO QUE MEDÍA DEL MURO NO SE BORRA: esa capacidad —enterarse de lo
     último sin entrar— se mudó a la pestaña «Hoy», así que se mide allá, con
     las clases que «Hoy» usa de verdad. Borrarla habría dejado de vigilar
     algo que sigue existiendo, que es como una suite deja de proteger. */
  const port = await pg.evaluate(() => {
    const home = document.querySelector('[data-view="home"]');
    const hijos = Array.from(home.children).filter(n => n.nodeType === 1);
    const graf = document.getElementById('sp-portada-graf');
    const esc = document.getElementById('sp-veredicto-escala');
    return {
      ids: hijos.map(n => n.id || n.className || n.tagName).join(' · '),
      nHijos: hijos.length,
      tira: home.querySelectorAll('.sp-pes-t').length,
      tiraMarcada: home.querySelectorAll('.sp-pes-t.on').length,
      h1: !!document.getElementById('sp-h1'),
      placa: !!document.getElementById('sp-hero-ficha'),
      muro: !!document.getElementById('sp-acceso-muro'),
      irFicha: !!document.getElementById('sp-ir-ficha'),
      stats: !!document.getElementById('sp-stats'),
      nav: !!home.querySelector('#sp-secciones'),
      escPeldanos: esc ? esc.querySelectorAll('.sp-vesc-p').length : 0,
      escTope: esc ? esc.querySelectorAll('.sp-vesc-tope').length : 0,
      escCap: esc ? (esc.querySelector('.sp-vesc-cap') || {}).textContent || '' : '',
      grafTarjetas: graf ? graf.querySelectorAll('.sp-graf').length : 0,
      /* El RECUENTO de los sellados es la una excepción, y va NOMBRADA por
         su clase y contada aparte: es el resumen del bloque entero y no un
         párrafo entre tarjeta y tarjeta —la v977 lo exige a la vista y sin
         abrir nada—. Nombrarla es lo que mantiene la aserción capaz de
         fallar: cualquier otro párrafo suelto sigue rompiéndola, y que el
         recuento FALTE rompe la de abajo. */
      grafSueltos: graf ? Array.from(graf.children)
        .filter(n => !/sp-graficas|sp-heroe|sp-graf-falta-t/.test(n.className)).length : 0,
      grafRecuento: graf ? graf.querySelectorAll(':scope > .sp-graf-falta-t').length : 0,
      grafSellos: graf ? graf.querySelectorAll('.sp-graf .sp-sello').length : 0,
      grafRecuentoTxt: graf ? ((graf.querySelector(':scope > .sp-graf-falta-t') || {}).textContent || '') : '',
      subtitulo: home.querySelectorAll(':scope > .sp-h1-sub').length
    };
  });
  console.log('\n── La portada (v1143) ───────────────────────────');
  console.log('  hijos: ' + port.ids);
  console.log('  ' + port.grafTarjetas + ' gráficas · escala: ' + port.escCap);

  /* CINCO desde la v1144, no cuatro: entró el SUBTÍTULO del h1, que dice el
     cargo y el período de quien se vigila. Se sube el número y se nombra la
     pieza nueva, que es lo contrario de aflojar: la aserción sigue
     rechazando cualquier pieza que nadie haya declarado —el muro, la placa,
     la rejilla de secciones—, y ahora también una SEXTA que aparezca sin
     que alguien venga a declararla acá. */
  chk(port.nHijos === 5 && port.subtitulo === 1,
      'la portada tiene exactamente cinco piezas: tira, título, subtítulo, escala y gráficos (' +
      port.nHijos + ' · ' + port.subtitulo + ' subtítulo)');
  chk(!port.placa && !port.muro && !port.irFicha && !port.stats && !port.nav,
      'y ninguna de las que la v1143 sacó: placa, muro, enlace a la ficha, cifras ni nav');
  chk(port.tira === 5 && port.tiraMarcada === 0,
      'la tira está, con sus cinco pestañas y NINGUNA marcada — la portada no es una pestaña (' +
      port.tira + ' / ' + port.tiraMarcada + ' marcadas)');
  chk(port.h1, 'y el título del documento se queda: una página sin encabezado es un defecto de accesibilidad');
  chk(port.escPeldanos === 5 && port.escTope === 1,
      'el veredicto sale como ESCALA, con sus cinco peldaños y uno marcado como tope (' +
      port.escPeldanos + ' · ' + port.escTope + ')');
  /* SIN distinguir mayúsculas desde la v1144: la frase pasó a llevar el
     nombre delante —«Veredicto sobre Fulano: no puede ser mejor que…»— y la
     inicial del peldaño quedó dentro de la oración. Lo que la aserción mide
     no cambia: que la escala DIGA cuál de los dos estados publica, que es la
     distinción de la v876. */
  chk(/no puede ser mejor que|dictamen/i.test(port.escCap),
      'y la escala dice si es un piso o un dictamen, que no son lo mismo (' + port.escCap + ')');
  chk(port.grafTarjetas >= 12,
      'el bloque trae TODO lo que el registro puede graficar, no una muestra (' +
      port.grafTarjetas + ' tarjetas)');
  chk(port.grafSueltos === 0,
      'y son solo gráficos: ningún párrafo suelto entre tarjeta y tarjeta (' +
      port.grafSueltos + ' sueltos)');
  /* Los sellados van EN SU SITIO y su recuento a la vista: las dos mitades,
     porque un sello sin recuento no dice cuántos faltan y un recuento sin
     sellos dice un número de gráficos que nadie ve. Y el recuento tiene que
     EMPEZAR por la cifra, que es lo que se lee sin abrir nada. */
  chk(port.grafSellos >= 1 && port.grafRecuento === 1,
      'los que no se pueden dibujar llevan su sello en su sitio, y UN recuento a la vista (' +
      port.grafSellos + ' sellos · ' + port.grafRecuento + ' recuento)');
  chk(/^\s*\d+ gráficos? lleva/.test(port.grafRecuentoTxt),
      'y el recuento abre con la cifra, no con la explicación (' +
      port.grafRecuentoTxt.slice(0, 48) + '…)');

  /* ── v1144 · DE QUIÉN ES EL SEGUIMIENTO ───────────────────────────────
     El h1 decía «Seguimiento Presidencial» y nada más. El nombre, el cargo y
     el período salen del REGISTRO, así que la aserción los compara contra el
     registro y no contra un literal: con el nombre escrito acá, el día que
     cambie el gobierno la suite diría que está mal justo cuando está bien. */
  const tit = await pg.evaluate(() => ({
    h1: (document.getElementById('sp-h1') || {}).textContent || '',
    sub: (document.querySelector('.sp-h1-sub') || {}).textContent || '',
    subs: document.querySelectorAll('.sp-h1-sub').length,
    cap: (document.querySelector('#sp-veredicto-escala .sp-vesc-cap') || {}).textContent || '',
    doc: document.title,
    og: (document.querySelector('meta[property="og:title"]') || {}).content || '',
    tw: (document.querySelector('meta[name="twitter:title"]') || {}).content || ''
  }));
  const nom = d.presidente, cargo = d.cargo, per = String(d.periodo || '').replace(/\s*–\s*/, '–');
  console.log('\n── El título (v1144) ────────────────────────────');
  console.log('  ' + tit.h1 + '\n  ' + tit.sub + '\n  ' + tit.cap);

  chk(!!nom && tit.h1.includes(nom) && /Seguimiento presidencial/i.test(tit.h1),
      'el h1 dice de quién es el seguimiento (' + tit.h1 + ')');
  chk(!!cargo && tit.sub.includes(cargo) && !!per && tit.sub.includes(per) && tit.subs === 1,
      'y el subtítulo trae el cargo y el período del registro, una sola vez (' +
      tit.sub + ' · ' + tit.subs + ')');
  chk(tit.cap.includes(nom), 'la escala dice sobre quién es el veredicto (' + tit.cap + ')');
  /* LA REDACCIÓN DE PISO NO SE TOCA, y es la aserción que más importa de las
     cinco: un piso promete que el dictamen no quedará POR ENCIMA de ese
     peldaño, y «X es poco fiable» promete otra cosa sobre una persona real.
     Se comprueba que mientras no haya dictamen la frase diga «no puede ser
     mejor que» y NUNCA el nombre seguido de «es». */
  /* EL NOMBRE DE LA ASERCIÓN NO CAMBIA CON LA RAMA, y esto lo arregló una
     inyección que salió VERDE: la primera versión tenía dos mensajes
     distintos —uno por rama— y al inyectar «Fulano es «Poco fiable»» el
     mensaje cambió de texto, así que el arnés no encontró la línea y lo leyó
     como aprobado. Es «una salida vacía no es una salida buena» entrando por
     el NOMBRE de la comprobación en vez de por su resultado. El nombre se
     queda fijo y la rama se dice en el detalle (v973, v1051). */
  const esPiso = /no puede ser mejor que/i.test(tit.cap);
  const hayDictamen = /dictamen/i.test(tit.cap);
  const comoSujeto = new RegExp(nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(es|era|resulta)\\b', 'i')
    .test(tit.cap);
  chk((esPiso || hayDictamen) && !comoSujeto,
      'el veredicto se publica como PISO o como DICTAMEN, nunca como predicado sobre la persona (' +
      (comoSujeto ? 'DICE «' + nom + ' es …»: convierte un tope en un juicio'
        : esPiso ? 'piso: «no puede ser mejor que»'
        : hayDictamen ? 'dictamen, nombrado como tal'
        : 'no dice ninguna de las dos cosas') + ')');
  chk(tit.doc.includes(nom) && tit.og.includes(nom) && tit.tw.includes(nom),
      'y el nombre llega a la pestaña del navegador y a la tarjeta del enlace (' +
      tit.doc.slice(0, 40) + '…)');

  /* ── v1147 · NINGÚN TEXTO QUEDA ATRAVESADO POR UNA LÍNEA ──────────────
     Pasó TRES veces: el rótulo de valor del dólar sobre la guía del hito, el
     del eje a 1440, y el del sector sobre la línea del cero. Dos trazos que
     se tocan se leen como uno, y en un gráfico eso no es fealdad: es un
     dígito que cambia de forma.

     SE MIDE LEGIBILIDAD, NO SOLAPE DE CAJAS, y esa distinción costó una
     vuelta: la cura de este módulo es un fondo opaco del color del papel
     pintado DESPUÉS de la línea, así que un texto puede compartir caja con
     ella y leerse perfectamente. Un cruce cuenta solo cuando NO hay fondo
     que tape, con doble condición —que el rectángulo cubra la caja del texto
     y que venga después de la línea en el orden de pintado, porque en SVG
     pinta el último—.

     Y SE MIDE A LOS DOS ANCHOS: el del eje del dólar no existía a 390 px
     —ahí la regla de ajuste omite ese rótulo— y sí a 1440. La v1146 midió un
     solo ancho y solo los rótulos que esa tanda había tocado; por eso se le
     escapó. */
  const crucesDe = async (ancho) => {
    await pg.setViewportSize({ width: ancho, height: 1200 });
    await pg.waitForTimeout(900);
    await pg.evaluate(() => window.dispatchEvent(new Event('resize')));
    await pg.waitForTimeout(1200);
    return pg.evaluate(() => {
      const malos = []; let tapados = 0, lineas = 0, textos = 0;
      document.querySelectorAll('.sp-view.on .sp-graf').forEach(sec => {
        const tit = ((sec.querySelector('.sp-graf-h') || {}).textContent || '').slice(0, 24);
        sec.querySelectorAll('svg').forEach(svg => {
          const orden = [...svg.querySelectorAll('*')];
          const ix = n => orden.indexOf(n);
          const vs = [...svg.querySelectorAll('line')]
            .filter(l => Math.abs(+l.getAttribute('x1') - +l.getAttribute('x2')) < 0.5)
            .map(l => ({ n: l, r: l.getBoundingClientRect() }));
          if (!vs.length) return;
          lineas += vs.length;
          const fondos = [...svg.querySelectorAll('rect')]
            .filter(x => /marfil/i.test(x.getAttribute('fill') || ''))
            .map(x => ({ n: x, r: x.getBoundingClientRect() }));
          [...svg.querySelectorAll('text')].forEach(t => {
            const tr = t.getBoundingClientRect();
            if (!tr.width) return;
            textos++;
            vs.forEach(l => {
              if (!(tr.left < l.r.right && tr.right > l.r.left &&
                    tr.top < l.r.bottom && tr.bottom > l.r.top)) return;
              const tapa = fondos.find(f =>
                f.r.left <= tr.left + 1 && f.r.right >= tr.right - 1 &&
                f.r.top <= tr.top + 1 && f.r.bottom >= tr.bottom - 1 && ix(f.n) > ix(l.n));
              if (tapa) tapados++;
              else malos.push(tit + ' → «' + t.textContent.slice(0, 24) + '»');
            });
          });
        });
      });
      return { malos: [...new Set(malos)], tapados, lineas, textos };
    });
  };
  const vpPrevio = pg.viewportSize();
  for (const ancho of [390, 1440]) {
    const c = await crucesDe(ancho);
    chk(c.lineas >= 2 && c.textos >= 10,
        'MATERIAL · a ' + ancho + ' px hay líneas verticales y textos que podrían cruzarse (' +
        c.lineas + ' líneas · ' + c.textos + ' textos)');
    chk(c.malos.length === 0,
        'y a ' + ancho + ' px ningún texto queda atravesado por una línea (' +
        (c.malos.length ? c.malos.slice(0, 3).join(' · ')
                        : c.tapados + ' resueltos con fondo, 0 sin tapar') + ')');
  }
  await pg.setViewportSize(vpPrevio);
  await pg.waitForTimeout(600);

  /* ── v1144 · EL COLOR Y EL LATIDO DE LA ESCALA ────────────────────────
     Tres cosas que se pueden romper por separado, y la tercera es la que de
     verdad importa: que LATA SOLO EL TOPE. El módulo publica un PISO —el
     borde superior de lo que el método prueba— y si «Nada fiable» latiera
     por estar todavía posible, la pantalla estaría afirmando más de lo que
     el registro sostiene. Es el mismo criterio que la frase de arriba. */
  const anim = await pg.evaluate(() => {
    const vivos = [];
    document.querySelectorAll('.sp-view.on *').forEach(n => {
      const cs = getComputedStyle(n);
      if (cs.animationName && cs.animationName !== 'none') {
        const dur = parseFloat(cs.animationDuration) || 0;
        vivos.push({ cls: String(n.className), dur, nombre: cs.animationName,
                     hz: dur > 0 ? 1 / dur : Infinity,
                     timing: cs.animationTimingFunction, iter: cs.animationIterationCount });
      }
    });
    const p = [...document.querySelectorAll('.sp-vesc-p')].map(n => ({
      est: n.classList.contains('sp-vesc-tope') ? 'tope'
         : n.classList.contains('sp-vesc-fuera') ? 'fuera' : 'posible',
      color: n.className.match(/sp-vesc-c(\d)/) ? +n.className.match(/sp-vesc-c(\d)/)[1] : 0,
      bg: getComputedStyle(n).backgroundColor,
      etiqueta: ((n.querySelector('.sp-vesc-e') || {}).textContent || '').trim(),
      tachado: /line-through/.test(getComputedStyle(n.querySelector('.sp-vesc-n')).textDecorationLine),
      anim: getComputedStyle(n).animationName
    }));
    return { vivos, p, borde: (() => { const t = document.querySelector('.sp-vesc-tope');
      return t ? getComputedStyle(t).borderTopWidth : ''; })() };
  });
  const topes = anim.p.filter(x => x.est === 'tope');
  const late = anim.p.filter(x => x.anim !== 'none');
  console.log('\n── La escala: color y latido (v1144) ────────────');
  anim.p.forEach(x => console.log('  ' + String(x.color) + ' ' + x.est.padEnd(8) + x.bg.padEnd(22) +
    x.etiqueta.padEnd(12) + 'anim=' + x.anim));

  chk(anim.p.length === 5 && anim.p.every(x => x.color >= 1 && x.color <= 5) &&
      new Set(anim.p.map(x => x.color)).size === 5,
      'los cinco peldaños llevan su color de fiabilidad, uno distinto cada uno (' +
      anim.p.map(x => x.color).join(',') + ')');
  chk(topes.length === 1 && late.length === 1 && late[0].est === 'tope',
      'y LATE SOLO EL TOPE: ni los descartados ni el que sigue posible (' +
      late.length + ' con animación · ' + (late[0] ? late[0].est : '—') + ')');
  /* El TECHO DE DESTELLOS. Se mide sobre TODA la vista y no solo sobre la
     escala: una animación rápida en cualquier otro sitio es el mismo riesgo
     para quien tiene fotosensibilidad. */
  const rapidas = anim.vivos.filter(v => v.hz > 3);
  chk(rapidas.length === 0 && anim.vivos.length >= 1,
      !anim.vivos.length ? 'MATERIAL · no hay ninguna animación que medir'
        : 'y ninguna animación de la vista pasa de 3 ciclos por segundo (' +
          anim.vivos.map(v => v.nombre + ' ' + v.dur + 's = ' + Math.round(v.hz * 100) / 100 + ' Hz').join(' · ') + ')');
  /* EL COLOR NO LLEVA EL SIGNIFICADO SOLO: la etiqueta de estado se queda en
     los cinco, y el tachado en los descartados. Sin esto, la paleta sería la
     única portadora y la escala dejaría de leerse en blanco y negro. */
  chk(anim.p.every(x => x.etiqueta.length > 3) &&
      anim.p.filter(x => x.est === 'fuera').every(x => x.tachado),
      'y el color no es el único portador: los cinco escriben su estado y los descartados van tachados (' +
      anim.p.map(x => x.etiqueta).join(' · ') + ')');

  /* QUIEN PIDIÓ MENOS MOVIMIENTO NO LO RECIBE, y el tope no pierde nada:
     conserva su color y gana borde. */
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  await pg.waitForTimeout(500);
  const red = await pg.evaluate(() => {
    let n = 0;
    document.querySelectorAll('.sp-view.on *').forEach(x => {
      const cs = getComputedStyle(x);
      if (cs.animationName && cs.animationName !== 'none') n++;
    });
    const t = document.querySelector('.sp-vesc-tope');
    return { n, borde: t ? parseFloat(getComputedStyle(t).borderTopWidth) : 0,
             bg: t ? getComputedStyle(t).backgroundColor : '',
             etiqueta: t ? ((t.querySelector('.sp-vesc-e') || {}).textContent || '').trim() : '' };
  });
  chk(red.n === 0 && red.borde >= 3 && red.bg === (topes[0] || {}).bg && red.etiqueta.length > 3,
      'con prefers-reduced-motion no queda ninguna animación, y el tope conserva color y gana borde (' +
      red.n + ' animaciones · borde ' + red.borde + 'px · ' + red.bg + ')');
  await pg.emulateMedia({ reducedMotion: 'no-preference' });
  await pg.waitForTimeout(400);

  /* ── v1144 · NINGUNA ETIQUETA DE EJE SE MONTA SOBRE OTRA ───────────────
     Llegó en captura de celular: «5 ago» sobre «7 ago» y «29 sep» sobre
     «30 sep» en el gráfico del dólar. Se mide EN EL NAVEGADOR y a los DOS
     anchos, porque el defecto depende del ancho: a 1440 no existía y a 390
     sí, así que una suite que midiera uno solo lo habría dado por bueno.

     Y se mide con `getBoundingClientRect`, no con el cálculo que usa el
     módulo para decidir: si la aserción usara la misma estimación que la
     función que arregla, estaría comprobando que la función coincide consigo
     misma (v878). */
  const solapesDe = async (ancho) => {
    await pg.setViewportSize({ width: ancho, height: 1200 });
    await pg.waitForTimeout(900);
    await pg.evaluate(() => window.dispatchEvent(new Event('resize')));
    await pg.waitForTimeout(1200);
    return pg.evaluate(() => {
      const malos = []; let nEt = 0, nLienzos = 0;
      document.querySelectorAll('.sp-view.on .sp-graf').forEach(sec => {
        const t = ((sec.querySelector('.sp-graf-h') || {}).textContent || '').slice(0, 30);
        sec.querySelectorAll('svg').forEach(svg => {
          const ets = [...svg.querySelectorAll('text.sp-g-pie-t[font-weight="600"]')]
            .map(x => ({ txt: x.textContent, r: x.getBoundingClientRect() }))
            .filter(x => x.r.width > 0);
          if (ets.length < 2) return;
          nLienzos++; nEt += ets.length;
          const filas = {};
          ets.forEach(x => { const k = Math.round(x.r.top); (filas[k] = filas[k] || []).push(x); });
          Object.keys(filas).forEach(k => {
            const f = filas[k].sort((a, z) => a.r.left - z.r.left);
            for (let i = 1; i < f.length; i++) {
              if (f[i].r.left < f[i - 1].r.right) {
                malos.push(t + ' → «' + f[i - 1].txt + '» / «' + f[i].txt + '» ' +
                  Math.round(f[i - 1].r.right - f[i].r.left) + ' px');
              }
            }
          });
        });
      });
      return { malos, nEt, nLienzos };
    });
  };
  const anchoOriginal = pg.viewportSize();
  for (const ancho of [390, 1440]) {
    const s = await solapesDe(ancho);
    /* MATERIAL primero (v920): sin etiquetas que mirar, la comprobación
       pasaría por no tener nada delante. */
    chk(s.nLienzos >= 2 && s.nEt >= 6,
        'MATERIAL · a ' + ancho + ' px hay ejes con varias etiquetas que podrían montarse (' +
        s.nLienzos + ' lienzos · ' + s.nEt + ' etiquetas)');
    chk(s.malos.length === 0,
        'y a ' + ancho + ' px ninguna etiqueta de eje se monta sobre otra (' +
        (s.malos.length ? s.malos.slice(0, 3).join(' · ') : s.nEt + ' etiquetas, 0 solapes') + ')');
  }
  await pg.setViewportSize(anchoOriginal);
  await pg.waitForTimeout(600);

  /* ── LO ÚLTIMO PUBLICADO, AHORA EN «HOY» ─────────────────────────────
     La capacidad es la misma que medía la portada hasta la v1142:
     enterarse de lo último SIN entrar a ningún sitio. Cambió de pestaña y
     de clases, no de propósito. */
  /* SE NAVEGA POR HASH Y NO CON goto: la suite enruta todas las peticiones
     contra `base` y cualquier otra cadena de origen se responde vacía, así
     que un `goto` con otra URL deja la página en blanco y las cuatro
     aserciones de abajo fallan por el transporte y no por el módulo. Lo
     delató que `.sp-view.on` saliera NULL, no la lectura. */
  await pg.evaluate(() => { location.hash = '#/al-dia'; });
  await pg.waitForTimeout(1400);
  const hoy = await pg.evaluate(() => {
    const a = document.querySelector('.sp-view.on article');
    if (!a) return null;
    const t = (sel) => { const n = a.querySelector(sel); return n ? (n.textContent || '').trim() : ''; };
    return {
      n: document.querySelectorAll('.sp-view.on article').length,
      tema: t('.sp-post-quien'),
      tag: !!a.querySelector('.sp-tag'),
      cuerpo: t('.sp-post-cuerpo'),
      txt: (a.innerText || '')
    };
  });
  console.log('\n── Lo último publicado, en «Hoy» ────────────────');
  console.log('  ' + (hoy ? hoy.n + ' fichas · ' + hoy.tema.replace(/\s+/g, ' ').slice(0, 60) : '(sin fichas)'));

  chk(!!hoy && hoy.n > 0, 'la pestaña «Hoy» trae las publicaciones');
  chk(!!hoy && hoy.cuerpo.length > 80,
      'la última va desplegada, con su detalle y no solo su titular (' +
      (hoy ? hoy.cuerpo.length : 0) + ' caracteres)');
  chk(!!hoy && /\d{4}/.test(hoy.txt),
      'y con su tema y su fecha real');
  chk(!!hoy && hoy.tag, 'incluye si el hecho está verificado o disputado');

  // Y que desde ahí se pueda entrar al hecho completo.
  await pg.evaluate(() => {
    const b2 = document.querySelector('.sp-view.on article button, .sp-view.on article a[href^="#"]');
    if (b2) b2.click();
  });
  await pg.waitForTimeout(500);
  const abrio = await pg.evaluate(() => {
    const v = document.querySelector('.sp-view.on');
    return { vista: v && v.getAttribute('data-view') };
  });
  chk(abrio.vista === 'hecho' || abrio.vista === 'hoy',
      'y desde ahí se entra al hecho completo con sus fuentes (' + abrio.vista + ')');
  await pg.evaluate(() => { location.hash = ''; });
  await pg.waitForTimeout(400);
  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await pg.screenshot({ path: '/tmp/seguimiento.png', fullPage: false });
  await b.close(); server.close();

  console.log(ok.map(t => '✅ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '❌ ' + t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
