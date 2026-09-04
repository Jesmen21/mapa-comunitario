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
  const nueva = d.entradas.find(e => /Deroga 11 circulares/.test(e.titulo));
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

  // ── Segundo caso: la fundación de la primera dama ──────────────────────
  const fund = d.entradas.find(e => /fundación de la primera dama/i.test(e.titulo));
  chk(!!fund, 'la entrada de la fundación está en el JSON');
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
  const bloq = d.entradas.find(e => /Bloque de Defensa/i.test(e.titulo));
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
  const firmas = d.entradas.find(e => /Registraduría invalidó/.test(e.titulo));
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
  const nulidad = d.entradas.find(e => /demanda de nulidad contra su elección/.test(e.titulo));
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
  const nombram = d.entradas.find(e => /nombramientos/.test(e.titulo));
  chk(!!nombram && nombram.titulo !== (nueva && nueva.titulo),
      'no se confunde con los 11 decretos de nombramientos del 21 de agosto');

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

  // ── Lo último publicado, arriba y desplegado ────────────────────────
  // Quien abre el módulo viene a saber qué pasó. Antes eso era un botón con
  // tres titulares sueltos, después de las gráficas: un titular obliga a
  // entrar para saber de qué se trata, y ese toque de más no se da.
  const aldia = await pg.evaluate(() => {
    const caja = document.getElementById('sp-acceso-muro');
    if (!caja) return null;
    const home = document.querySelector('[data-view="home"]');
    const hijos = Array.from(home.children);
    const rCaja = caja.getBoundingClientRect();
    const graf = document.getElementById('sp-hero-graf');
    const lede = home.querySelector('.sp-lede');
    const dest = caja.querySelector('.sp-nuevo-dest');
    // Las entradas ordenadas por fecha, para saber cuál es la última real.
    return {
      posicion: hijos.indexOf(caja),
      total: hijos.length,
      // Ancho respecto a la columna: "una ventana muy corta" era el reclamo.
      anchoPct: Math.round(100 * rCaja.width / home.getBoundingClientRect().width),
      alto: Math.round(rCaja.height),
      arribaDeGraficas: !!graf && rCaja.top < graf.getBoundingClientRect().top,
      arribaDelTitulo: !!lede && rCaja.top < lede.getBoundingClientRect().top,
      hayDestacado: !!dest,
      titulo: dest ? (dest.querySelector('.sp-nuevo-tit') || {}).textContent || '' : '',
      detalle: dest ? (dest.querySelector('.sp-nuevo-det') || {}).textContent || '' : '',
      tema: dest ? (dest.querySelector('.sp-nuevo-tema') || {}).textContent || '' : '',
      fecha: dest ? (dest.querySelector('.sp-nuevo-fecha') || {}).textContent || '' : '',
      tag: dest ? !!dest.querySelector('.sp-tag') : false,
      antes: caja.querySelectorAll('.sp-nuevo-item').length,
      semana: (caja.querySelector('.sp-nuevo-semana') || {}).textContent || '',
      txt: caja.innerText
    };
  });
  console.log('\n── Al día en la portada ─────────────────────────');
  console.log('  posición ' + (aldia.posicion + 1) + ' de ' + aldia.total +
              ' · ancho ' + aldia.anchoPct + '% · alto ' + aldia.alto + ' px');
  console.log('  destacado: ' + aldia.titulo.slice(0, 90));
  console.log('  ' + aldia.tema + ' · ' + aldia.fecha + ' · ' + aldia.semana);

  chk(!!aldia, 'la portada trae el bloque de lo último publicado');
  chk(aldia.posicion === 0, 'y es lo PRIMERO de la portada (va ' + (aldia.posicion + 1) + 'º)');
  chk(aldia.arribaDelTitulo && aldia.arribaDeGraficas,
      'por encima del título del módulo y de las gráficas');
  chk(aldia.anchoPct >= 95, 'ocupa el ancho completo de la columna (' + aldia.anchoPct + '%)');
  chk(aldia.alto >= 260, 'con alto suficiente para leerse, no una ventanita (' + aldia.alto + ' px)');
  // Lo esencial: que se pueda uno enterar SIN entrar.
  chk(aldia.hayDestacado, 'la última publicación va desplegada, no solo su titular');
  chk(aldia.titulo.length > 20 && aldia.detalle.length > 80,
      'con su título y su detalle completo (' + aldia.detalle.length + ' caracteres)');
  chk(!!aldia.tema && /\d{4}/.test(aldia.fecha),
      'y con su tema y su fecha real (' + aldia.tema + ' · ' + aldia.fecha + ')');
  chk(aldia.tag, 'incluye si el hecho está verificado o disputado');
  chk(/Última publicación/.test(aldia.txt), 'dice cuándo fue la última publicación');
  chk(/registros? esta semana/.test(aldia.semana),
      'y cuántos registros van esta semana, para saber si está al día');
  chk(aldia.antes >= 2, 'debajo, lo que vino antes (' + aldia.antes + ')');

  // Y que desde ahí se pueda entrar al hecho completo.
  await pg.evaluate(() => document.querySelector('.sp-nuevo-abrir').click());
  await pg.waitForTimeout(400);
  const abrio = await pg.evaluate(() => {
    const v = document.querySelector('.sp-view.on');
    return { vista: v && v.getAttribute('data-view'),
             txt: (v ? v.innerText : '').slice(0, 400) };
  });
  chk(abrio.vista === 'hecho',
      'y desde ahí se entra al hecho completo con sus fuentes (' + abrio.vista + ')');
  await pg.evaluate(() => { location.hash = ''; });
  await pg.waitForTimeout(300);
  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await pg.screenshot({ path: '/tmp/seguimiento.png', fullPage: false });
  await b.close(); server.close();

  console.log(ok.map(t => '✅ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '❌ ' + t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
