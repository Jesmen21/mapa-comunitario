const E = require('../entorno.js');
/* La ficha del gobernante: que ninguna cifra sea escrita a mano.

   Es una ficha de personaje —estilo Rome: Total War— sobre una PERSONA REAL.
   El estilo se puede tomar prestado; la libertad de inventarle atributos, no.
   La regla de la sección es que todo número salga de contar el registro, y
   esta prueba existe para que esa regla no dependa de la buena voluntad de
   quien edite el archivo mañana.

   Por eso las cuentas se rehacen ACÁ, en Node, leyendo el JSON directamente,
   y se comparan contra lo que la página muestra. Si alguien escribe un «74 %»
   a mano, o afloja el criterio de un veredicto, las dos cuentas dejan de
   coincidir y la suite lo dice.

   Lo demás que vigila:

   · Que el veredicto siga su escalera, comprobada con registros de mentira
     armados aquí: cero cambios y todo verificado → «se sostiene»; tres
     cambios → «en entredicho»; registro corto → «sin datos suficientes».
     Esto último importa tanto como el resto: con cuatro hechos publicados no
     se puede calificar a nadie.
   · Que una acusación DESMENTIDA no sume en contra. Es el error que
     convertiría el módulo en un amplificador de bulos.
   · Que un caso con `cuenta:false` quede a la vista, con su motivo, y no
     escondido: la conversión religiosa está documentada, pero el propio
     registro anotó que no es señalamiento de hipocresía.
   · Y que los rasgos sean los del FODA, no una segunda opinión inventada
     aquí sin evidencia detrás.                                             */
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

  // ── Las mismas cuentas, hechas aparte ────────────────────────────────
  const D = JSON.parse(fs.readFileSync(REPO + '/assets/data/seguimiento-presidencial.json', 'utf8'));
  const desdePosesion = (D.entradas || []).filter(e => e.fecha && e.fecha >= D.posesion);
  const casos = ((D.contradicciones || {}).casos || []);
  const esperado = {
    hechos: desdePosesion.length,
    verificado: desdePosesion.filter(e => e.tipoFuente === 'verificado').length,
    disputado: desdePosesion.filter(e => e.tipoFuente === 'disputado').length,
    declaracion: desdePosesion.filter(e => e.tipoFuente === 'declaracion').length,
    revisados: casos.length,
    contadas: casos.filter(c => c.estado === 'documentada' && c.cuenta !== false).length,
    desmentidas: casos.filter(c => c.estado === 'desmentida').length,
    noCuentan: casos.filter(c => c.estado === 'documentada' && c.cuenta === false).length,
    frentes: new Set(desdePosesion.map(e => e.categoria)).size,
    rasgos: ((D.foda || {}).fortalezas || []).length + ((D.foda || {}).debilidades || []).length
  };
  esperado.conTipo = esperado.verificado + esperado.disputado + esperado.declaracion;
  esperado.pct = esperado.conTipo ? Math.round(100 * esperado.verificado / esperado.conTipo) : null;

  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(e.message));
  await pg.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    return route.fulfill({ status: 200, body: '' });
  });

  // Enlace profundo: la ficha tiene que abrir sola, no solo si se navega.
  await pg.goto(base + '/seguimiento.html#/ficha-del-gobernante', { waitUntil: 'load' });
  await pg.waitForTimeout(1100);

  const r = await pg.evaluate(() => {
    /* Lo del DOM se lee SIEMPRE, exista o no la ficha: una suite que revienta
       cuando falta lo que comprueba no dice cuál de sus comprobaciones falló,
       y eso es justo lo que hace falta saber. */
    const api = window.URBIS_SEG_FICHA;
    const o = { hayApi: !!api, f: {}, pruebas: {}, escalera: [], txt: '', rasgos: 0,
                casosPintados: 0, casosPesan: 0, puntos: 0, puntosSinColor: 0,
                serie: { n: 0, ultimaEnCurso: false }, acumulaCreciendo: false };

    o.vista = (document.querySelector('.sp-view.on') || {}).getAttribute
      ? document.querySelector('.sp-view.on').getAttribute('data-view') : '';
    const caja = document.getElementById('sp-ficha');
    o.txt = caja ? caja.innerText : '';
    o.rasgos = caja ? caja.querySelectorAll('.sp-fi-rasgo').length : 0;
    o.casosPintados = caja ? caja.querySelectorAll('.sp-fi-caso').length : 0;
    o.casosPesan = caja ? caja.querySelectorAll('.sp-fi-caso.pesa').length : 0;
    o.escalera = [...(caja ? caja.querySelectorAll('.sp-fi-paso') : [])]
      .map(x => x.textContent + (x.classList.contains('on') ? '*' : ''));
    // Los puntos de la leyenda: si uno queda transparente, la barra pierde su
    // clave y las cuentas se leen sin saber a qué tramo pertenece cada una.
    o.puntosSinColor = [...(caja ? caja.querySelectorAll('.sp-fi-pt') : [])]
      .filter(x => {
        const bg = getComputedStyle(x).backgroundColor;
        return !bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
      }).length;
    o.puntos = caja ? caja.querySelectorAll('.sp-fi-pt').length : 0;
    // La serie y su última columna, que casi siempre es media semana.
    const cols = [...(caja ? caja.querySelectorAll('.sp-fi-col') : [])];
    o.serie = { n: cols.length, ultimaEnCurso: cols.length ? /en curso/.test(cols[cols.length - 1].innerText) : false };
    if (!api) return o;

    const f = api.calcular(null);
    o.f = { hechos: f.ritmo.hechos, verificado: f.claridad.verificado,
            disputado: f.claridad.disputado, declaracion: f.claridad.declaracion,
            pct: f.claridad.pct, revisados: f.palabra.revisados,
            contadas: f.palabra.contadas, desmentidas: f.palabra.desmentidas,
            noCuentan: f.palabra.noCuentan, frentes: f.alcance.activos,
            veredicto: f.veredicto.id, regla: f.veredicto.d };
    const s = api.serie();
    o.acumulaCreciendo = s.every((p, i) => !i || p.hechos >= s[i - 1].hechos);

    // ── La escalera, con registros de mentira ────────────────────────
    const hechos = (n, tipo) => Array.from({ length: n }, (_, i) => ({
      fecha: '2026-08-1' + (i % 9), categoria: 'gobierno', tipoFuente: tipo }));
    const armar = (nHechos, tipo, casos) => ({
      posesion: '2026-08-07', categorias: { gobierno: {} },
      entradas: hechos(nHechos, tipo), contradicciones: { casos: casos }, foda: {} });
    const cx = (estado, cuenta) => ({ estado: estado, cuenta: cuenta, tema: 't' });
    const limpio = [cx('desmentida'), cx('desmentida'), cx('tension')];
    o.pruebas = {
      // Todo verificado y ningún cambio de postura contado.
      sostiene: api.calcularCon(armar(40, 'verificado', limpio), '2026-08-20').veredicto.id,
      // Un cambio contado basta para bajar a "con reparos".
      reparos: api.calcularCon(armar(40, 'verificado', limpio.concat([cx('documentada')])), '2026-08-20').veredicto.id,
      // Tres, a "en entredicho".
      entredicho: api.calcularCon(armar(40, 'verificado',
        limpio.concat([cx('documentada'), cx('documentada'), cx('documentada')])), '2026-08-20').veredicto.id,
      // Sin cambios de postura pero con el registro sin verificar.
      porClaridad: api.calcularCon(armar(40, 'declaracion', limpio), '2026-08-20').veredicto.id,
      // Registro corto: no alcanza para calificar a nadie.
      pocosHechos: api.calcularCon(armar(4, 'verificado', limpio), '2026-08-20').veredicto.id,
      pocosCasos: api.calcularCon(armar(40, 'verificado', [cx('documentada')]), '2026-08-20').veredicto.id,
      // Una acusación DESMENTIDA no puede sumar en contra.
      soloDesmentidas: api.calcularCon(armar(40, 'verificado',
        [cx('desmentida'), cx('desmentida'), cx('desmentida'), cx('desmentida')]), '2026-08-20').veredicto.id,
      // Y `cuenta:false` tiene que restar del conteo, no del registro.
      conCuentaFalse: api.calcularCon(armar(40, 'verificado',
        limpio.concat([cx('documentada', false), cx('documentada', false)])), '2026-08-20').veredicto.id
    };
    return o;
  });

  chk(r.hayApi, 'la ficha publica su cálculo para poder comprobarlo');
  chk(r.vista === 'ficha', 'el enlace profundo #/ficha-del-gobernante abre la ficha (' + r.vista + ')');

  const f = r.f || {};
  console.log('\n── Lo que muestra la ficha ─────────────────────────');
  console.log('  ' + f.hechos + ' hechos · ' + f.pct + ' % verificado · ' +
              f.contadas + '/' + f.revisados + ' cambios contados · ' + f.veredicto);

  console.log('\n── Cada cifra, recontada aparte sobre el JSON ──────');
  [['hechos desde la posesión', 'hechos'], ['verificados', 'verificado'],
   ['disputados', 'disputado'], ['de una sola voz', 'declaracion'],
   ['porcentaje verificado', 'pct'], ['casos de postura revisados', 'revisados'],
   ['cambios que cuentan', 'contadas'], ['acusaciones desmentidas', 'desmentidas'],
   ['documentados que no cuentan', 'noCuentan'], ['frentes con hechos', 'frentes']
  ].forEach(([nombre, k]) => {
    chk(f[k] === esperado[k], 'coincide ' + nombre + ' (ficha ' + f[k] + ' · recuento ' + esperado[k] + ')');
  });

  console.log('\n── La escalera del veredicto ───────────────────────');
  const p = r.pruebas || {};
  chk(p.sostiene === 'sostiene', 'sin cambios y todo verificado → se sostiene (' + p.sostiene + ')');
  chk(p.reparos === 'reparos', 'un cambio contado → con reparos (' + p.reparos + ')');
  chk(p.entredicho === 'entredicho', 'tres cambios contados → en entredicho (' + p.entredicho + ')');
  chk(p.porClaridad === 'entredicho', 'registro sin verificar → en entredicho aunque no haya cambios (' + p.porClaridad + ')');
  chk(p.pocosHechos === 'sin-datos', 'con cuatro hechos no se califica a nadie (' + p.pocosHechos + ')');
  chk(p.pocosCasos === 'sin-datos', 'ni con un solo caso de postura revisado (' + p.pocosCasos + ')');
  chk(p.soloDesmentidas === 'sostiene',
      'cuatro acusaciones DESMENTIDAS no bajan el veredicto (' + p.soloDesmentidas + ')');
  chk(p.conCuentaFalse === 'sostiene',
      'y un caso marcado «no cuenta» no suma al veredicto (' + p.conCuentaFalse + ')');

  console.log('\n── Lo que se ve ────────────────────────────────────');
  chk(r.casosPintados === esperado.revisados,
      'los casos salen todos, contados y no contados (' + r.casosPintados + ')');
  chk(r.casosPesan === esperado.contadas,
      'y solo los que cuentan van marcados (' + r.casosPesan + ')');
  chk(/No cuenta: .*desmentida/.test(r.txt), 'dice por qué un caso desmentido no cuenta');
  chk(/No cuenta: .*hipocresía|No cuenta: .*no es señalamiento/.test(r.txt),
      'y por qué el caso marcado en el registro tampoco');
  chk(r.escalera.filter(x => /\*$/.test(x)).length === 1,
      'la escalera marca un solo peldaño: ' + r.escalera.join(' · '));
  chk(/No mide honestidad/.test(r.txt), 'dice en la cara qué NO mide');
  chk(/no es una nota de gestión/i.test(r.txt), 'y que no es una nota de gestión');
  chk(r.rasgos === esperado.rasgos,
      'los rasgos son los del FODA, ni uno más (' + r.rasgos + ' de ' + esperado.rasgos + ')');
  chk(r.puntos > 6 && r.puntosSinColor === 0,
      'todos los puntos de la leyenda tienen color (' + r.puntosSinColor + ' sin color de ' + r.puntos + ')');
  chk(r.serie.n >= 3 && r.serie.ultimaEnCurso,
      'la serie marca la semana en curso, que siempre va a medias (' + r.serie.n + ' columnas)');
  chk(r.acumulaCreciendo, 'y el acumulado de la serie nunca baja');
  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close(); server.close();

  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
