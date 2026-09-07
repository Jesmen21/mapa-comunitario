const E = require('../entorno.js');
/* La ficha del gobernante: que ninguna cifra sea escrita a mano, y que lo
   más polémico vaya primero.

   Es una ficha de personaje —estilo Rome: Total War— sobre una PERSONA REAL.
   El estilo se puede tomar prestado; la libertad de inventarle atributos, no.
   La regla de la sección es que todo número salga de contar el registro, y
   esta prueba existe para que esa regla no dependa de la buena voluntad de
   quien edite el archivo mañana.

   Por eso las cuentas se rehacen ACÁ, en Node, leyendo el JSON directamente,
   y se comparan contra lo que la página muestra. Si alguien escribe un «74 %»
   a mano, o afloja el criterio de un veredicto, las dos cuentas dejan de
   coincidir y la suite lo dice.

   Lo que vigila desde la v791:

   · La escalera nueva: cinco peldaños por cómo se ha MOSTRADO, sin peldaño
     intermedio de gracia. Tres techos (casos confirmados, cambios de postura,
     % verificado) y el veredicto es el PEOR de los tres, comprobado con
     registros de mentira: un caso confirmado y todo lo demás limpio → «poco
     fiable»; dos confirmados → «nada fiable»; limpio al 90 % → inquebrantable.
   · Que solo `confirmado` pese: un señalamiento o una investigación abierta se
     muestran con su etiqueta y no mueven el veredicto. Un `por-documentar` ni
     se pinta.
   · Que una acusación DESMENTIDA no sume en contra, y que `cuenta:false`
     quede a la vista con su motivo.
   · Los rasgos: derivados de cuentas con umbral declarado; aparecen y
     desaparecen con la cuenta, nunca a mano.
   · El orden de lectura en el DOM: casos confirmados antes que en
     investigación, estos antes que señalamientos, y todos antes que las
     contradicciones; los rasgos después; el método al final. Se busca por la
     cabecera de cada sección, no por el texto de toda la hoja.
   · La portada: la placa es lo PRIMERO del módulo, con el veredicto y sus
     tres cuentas, y al tocarla se abre la ficha.                            */
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
  const corr = ((D.casos || {}).lista || []);
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
    confirmados: corr.filter(c => c.estado === 'confirmado').length,
    enInvestigacion: corr.filter(c => c.estado === 'en-investigacion').length,
    senalamientos: corr.filter(c => c.estado === 'senalamiento').length,
    porDocumentar: corr.filter(c => c.estado === 'por-documentar').length
  };
  esperado.conTipo = esperado.verificado + esperado.disputado + esperado.declaracion;
  esperado.pct = esperado.conTipo ? Math.round(100 * esperado.verificado / esperado.conTipo) : null;
  esperado.visibles = esperado.confirmados + esperado.enInvestigacion + esperado.senalamientos;
  // El veredicto, rehecho aquí con la MISMA regla escrita aparte.
  const techo = {
    // Confirmados: uno → poco fiable, dos → nada fiable. En investigación
    // (desde la v792 también pesan): uno → dudosa, dos → poco fiable.
    casos: (conf, inv) => Math.max(conf >= 2 ? 4 : conf >= 1 ? 3 : 0, inv >= 2 ? 3 : inv >= 1 ? 2 : 0),
    palabra: n => n >= 3 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0,
    claridad: p => p == null ? 0 : p < 50 ? 3 : p < 70 ? 2 : p < 85 ? 1 : 0
  };
  const IDS = ['inquebrantable', 'fiable', 'dudosa', 'poco-fiable', 'nada-fiable'];
  esperado.veredicto = (esperado.revisados < 3 || esperado.hechos < 20) ? 'sin-datos'
    : IDS[Math.max(techo.casos(esperado.confirmados, esperado.enInvestigacion), techo.palabra(esperado.contadas), techo.claridad(esperado.pct))];

  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(e.message));
  await pg.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('about:')) return route.continue();
    return route.fulfill({ status: 200, body: '' });
  });

  /* Primero la PORTADA: el módulo abre en el perfil. La placa con el
     veredicto es lo primero que se ve, antes de lo último publicado y del
     título; el botón viejo de acceso ya no existe. */
  await pg.goto(base + '/seguimiento.html', { waitUntil: 'load' });
  await pg.waitForTimeout(1100);
  const portada = await pg.evaluate(() => {
    const home = document.querySelector('[data-view="home"]');
    const hijos = Array.from(home.children);
    const hero = document.getElementById('sp-hero-ficha');
    const placa = hero && hero.querySelector('.sp-fi-placa');
    if (!placa) return { hay: false };
    const r = placa.getBoundingClientRect();
    const vval = placa.querySelector('.sp-fi-vval');
    const tam = el => parseFloat(getComputedStyle(el).fontSize);
    const masGrande = Math.max(...Array.from(document.querySelectorAll('.sp-view.on *'))
      .filter(x => x.children.length === 0 && x.textContent.trim()).map(tam));
    return { hay: true,
             posicion: hijos.indexOf(hero),
             botonViejo: !!document.getElementById('sp-acceso-ficha'),
             muroDespues: hijos.indexOf(document.getElementById('sp-acceso-muro')) === hijos.indexOf(hero) + 1,
             arribaDelTitulo: r.top < home.querySelector('.sp-lede').getBoundingClientRect().top,
             anchoPct: Math.round(100 * r.width / home.getBoundingClientRect().width),
             veredicto: vval ? vval.textContent : '',
             tamVeredicto: vval ? tam(vval) : 0, masGrande: masGrande,
             cuentas: (placa.querySelector('.sp-fi-cuentas') || {}).textContent || '',
             secs: Array.from(document.querySelectorAll('#sp-secciones .sp-sec')).map(x =>
               (x.querySelector('.sp-sec-n') || {}).textContent + ' ' + (x.querySelector('.sp-sec-t') || {}).textContent) };
  });
  chk(portada.hay, 'la portada del módulo abre con la placa del gobernante');
  if (portada.hay) {
    console.log('\n── La portada ──────────────────────────────────────');
    console.log('  ' + portada.veredicto + ' · ' + portada.cuentas);
    console.log('  ' + portada.secs.join(' · '));
    chk(portada.posicion === 0, 'y la placa es lo PRIMERO (va ' + (portada.posicion + 1) + 'º)');
    chk(portada.muroDespues && portada.arribaDelTitulo, 'lo último publicado va justo debajo, y el título después');
    chk(!portada.botonViejo, 'el botón viejo de acceso a la ficha ya no está');
    chk(portada.anchoPct >= 95, 'ocupa el ancho de la columna (' + portada.anchoPct + '%)');
    chk(/casos? confirmados?/.test(portada.cuentas) && /en investigación/.test(portada.cuentas) &&
        /cambios? de postura/.test(portada.cuentas) && /% verificado|sin verificación/.test(portada.cuentas),
        'enseña las cuentas que producen el veredicto, con los casos en investigación');
    chk(portada.tamVeredicto >= portada.masGrande - 0.5,
        'el veredicto es el texto más grande de la portada (' + portada.tamVeredicto + ' px)');
    chk(portada.secs[0] === '00 Ficha del gobernante' && portada.secs[1] === '01 Contradicciones' &&
        portada.secs[2] === '02 Al día',
        'la rejilla va por polémica: ficha 00, contradicciones 01, al día 02');
    await pg.evaluate(() => document.querySelector('#sp-hero-ficha button').click());
    await pg.waitForTimeout(500);
    const fue = await pg.evaluate(() => (document.querySelector('.sp-view.on') || {}).getAttribute
      ? document.querySelector('.sp-view.on').getAttribute('data-view') : '');
    chk(fue === 'ficha', 'y al tocar la placa se abre la ficha (' + fue + ')');
  }

  // Enlace profundo: la ficha tiene que abrir sola, no solo si se navega.
  await pg.goto(base + '/seguimiento.html#/ficha-del-gobernante', { waitUntil: 'load' });
  await pg.waitForTimeout(1100);

  const r = await pg.evaluate(() => {
    /* Lo del DOM se lee SIEMPRE, exista o no la ficha: una suite que revienta
       cuando falta lo que comprueba no dice cuál de sus comprobaciones falló. */
    const api = window.URBIS_SEG_FICHA;
    const o = { hayApi: !!api, f: {}, pruebas: {}, escalera: [], txt: '', rasgos: [],
                cxPintados: 0, cxPesan: 0, ccPintados: 0, ccPorEstado: {}, orden: {}, puntos: 0, puntosSinColor: 0,
                serie: { n: 0, ultimaEnCurso: false }, acumulaCreciendo: false, sinPeldanoViejo: true, minPx: 99 };

    o.vista = (document.querySelector('.sp-view.on') || {}).getAttribute
      ? document.querySelector('.sp-view.on').getAttribute('data-view') : '';
    const caja = document.getElementById('sp-ficha');
    o.txt = caja ? caja.innerText : '';
    if (caja) {
      o.rasgos = Array.from(caja.querySelectorAll('.sp-fi-rasgo')).map(x => x.innerText);
      o.cxPintados = caja.querySelectorAll('.sp-fi-caso').length;
      o.cxPesan = caja.querySelectorAll('.sp-fi-caso.pesa').length;
      o.ccPintados = caja.querySelectorAll('.sp-fi-cc').length;
      ['conf', 'inv', 'sen', 'pend'].forEach(k => { o.ccPorEstado[k] = caja.querySelectorAll('.sp-fi-cc-' + k).length; });
      o.escalera = Array.from(caja.querySelectorAll('.sp-fi-paso')).map(x => x.textContent + (x.classList.contains('on') ? '*' : ''));
      // El orden de lectura, por la CABECERA de cada sección.
      const y = sel => { const n = caja.querySelector(sel); return n ? n.getBoundingClientRect().top + window.scrollY : null; };
      const cab = t => { const h = Array.from(caja.querySelectorAll('.sp-fi-sech h3')).find(x => x.textContent.trim() === t); return h ? h.getBoundingClientRect().top + window.scrollY : null; };
      o.orden = { placa: y('.sp-fi-placa'), casos: cab('Casos de corrupción'), cx: cab('Contradicciones'),
                  rasgos: cab('Rasgos'), serie: cab('Cómo va'), metodo: cab('Método'),
                  conf: y('.sp-fi-cc-conf'), inv: y('.sp-fi-cc-inv'), sen: y('.sp-fi-cc-sen'),
                  cxPesa: y('.sp-fi-caso.pesa'), cxNoPesa: y('.sp-fi-caso:not(.pesa)') };
      o.puntosSinColor = Array.from(caja.querySelectorAll('.sp-fi-pt')).filter(x => {
        const bg = getComputedStyle(x).backgroundColor;
        return !bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
      }).length;
      o.puntos = caja.querySelectorAll('.sp-fi-pt').length;
      const cols = Array.from(caja.querySelectorAll('.sp-fi-col'));
      o.serie = { n: cols.length, ultimaEnCurso: cols.length ? /en curso/.test(cols[cols.length - 1].innerText) : false };
      // Ningún texto corrido por debajo de 13 px en teléfono (etiquetas en
      // mayúsculas y sellos aparte, que son otra cosa).
      o.minPx = Math.min(...Array.from(caja.querySelectorAll('p, li, span.sp-fi-casod, .sp-fi-caso-mom > span'))
        .filter(x => x.textContent.trim().length > 40)
        .map(x => parseFloat(getComputedStyle(x).fontSize)));
      o.sinPeldanoViejo = !/sp-fi-v-(sostiene|reparos|entredicho)\b/.test(caja.innerHTML);
      // El color del veredicto en la placa se lee: contraste sobre la placa oscura.
      const vv = caja.querySelector('.sp-fi-placa .sp-fi-vval');
      o.colorVeredicto = vv ? getComputedStyle(vv).color : '';
    }
    if (!api) return o;

    const f = api.calcular(null);
    // Con el código viejo `casos` y `rasgos` no existen: que la prueba lo diga.
    f.casos = f.casos || {}; f.rasgos = f.rasgos || []; f.manda = f.manda || [];
    o.f = { hechos: f.ritmo.hechos, verificado: f.claridad.verificado,
            disputado: f.claridad.disputado, declaracion: f.claridad.declaracion,
            pct: f.claridad.pct, revisados: f.palabra.revisados,
            contadas: f.palabra.contadas, desmentidas: f.palabra.desmentidas,
            noCuentan: f.palabra.noCuentan, frentes: f.alcance.activos,
            confirmados: f.casos.confirmados, enInvestigacion: f.casos.enInvestigacion,
            senalamientos: f.casos.senalamientos, porDocumentar: f.casos.porDocumentar,
            veredicto: f.veredicto.id, manda: f.manda, rasgos: f.rasgos.map(x => x.id) };
    const s = api.serie();
    o.acumulaCreciendo = s.every((p, i) => !i || p.hechos >= s[i - 1].hechos);
    o.escaleraApi = api.escalera.map(x => x.id);

    // ── La escalera, con registros de mentira ────────────────────────
    const hechos = (n, tipo) => Array.from({ length: n }, (_, i) => ({
      fecha: '2026-08-1' + (i % 9), categoria: 'gobierno', tipoFuente: tipo }));
    const armar = (nHechos, tipo, cxs, corr) => ({
      posesion: '2026-08-07', categorias: { gobierno: {} },
      entradas: hechos(nHechos, tipo), contradicciones: { casos: cxs },
      casos: { lista: corr || [] }, foda: {} });
    const cx = (estado, cuenta) => ({ estado: estado, cuenta: cuenta, tema: 't' });
    const caso = estado => ({ id: 'c', titulo: 'c', estado: estado, fecha: '2026-08-10', fuentes: [{ n: 'x', u: 'https://x' }] });
    const limpio = [cx('desmentida'), cx('desmentida'), cx('tension')];
    const V = (n, t, cxs, corr) => api.calcularCon(armar(n, t, cxs, corr), '2026-08-20').veredicto.id;
    // 40 hechos, 36 verificados y 4 disputados = 90 %.
    const mixto90 = hechos(36, 'verificado').concat(hechos(4, 'disputado'));
    const mixto = (nv, nd) => hechos(nv, 'verificado').concat(hechos(nd, 'disputado'));
    const Vm = (ent, cxs, corr) => api.calcularCon({ posesion: '2026-08-07', categorias: { gobierno: {} },
      entradas: ent, contradicciones: { casos: cxs }, casos: { lista: corr || [] } }, '2026-08-20').veredicto.id;
    o.pruebas = {
      inquebrantable: Vm(mixto90, limpio),
      // Un cambio de postura → como mucho fiable.
      unCambio: Vm(mixto90, limpio.concat([cx('documentada')])),
      // Dos → dudosa. Tres → poco fiable.
      dosCambios: Vm(mixto90, limpio.concat([cx('documentada'), cx('documentada')])),
      tresCambios: Vm(mixto90, limpio.concat([cx('documentada'), cx('documentada'), cx('documentada')])),
      // El % verificado pone su propio techo: 80 → fiable; 60 → dudosa; 40 → poco fiable.
      pct80: Vm(mixto(32, 8), limpio), pct60: Vm(mixto(24, 16), limpio), pct40: Vm(mixto(16, 24), limpio),
      // Un caso CONFIRMADO baja a poco fiable aunque todo lo demás esté limpio; dos, nada fiable.
      unConfirmado: Vm(mixto90, limpio, [caso('confirmado')]),
      dosConfirmados: Vm(mixto90, limpio, [caso('confirmado'), caso('confirmado')]),
      // Lo no confirmado NO mueve el veredicto.
      soloSenalamientos: Vm(mixto90, limpio, [caso('senalamiento'), caso('senalamiento'), caso('por-documentar')]),
      // Un caso EN INVESTIGACIÓN ya pesa: uno → dudosa; dos → poco fiable. Menos que un confirmado.
      unaInvestigacion: Vm(mixto90, limpio, [caso('en-investigacion')]),
      dosInvestigaciones: Vm(mixto90, limpio, [caso('en-investigacion'), caso('en-investigacion')]),
      confirmadoMandaSobreInv: Vm(mixto90, limpio, [caso('confirmado'), caso('en-investigacion')]),
      // El peor de tres: un cambio (fiable) + 60 % (dudosa) → dudosa, no un promedio.
      peorDeTres: Vm(mixto(24, 16), limpio.concat([cx('documentada')])),
      // Registro corto: no alcanza para calificar a nadie.
      pocosHechos: V(4, 'verificado', limpio),
      pocosCasos: V(40, 'verificado', [cx('documentada')]),
      // Una acusación DESMENTIDA no puede sumar en contra.
      soloDesmentidas: Vm(mixto90, [cx('desmentida'), cx('desmentida'), cx('desmentida'), cx('desmentida')]),
      // Y `cuenta:false` resta del conteo, no del registro.
      conCuentaFalse: Vm(mixto90, limpio.concat([cx('documentada', false), cx('documentada', false)])),
      // Un por-documentar no se cuenta como visible ni pesa.
      porDocumentarOculto: api.calcularCon(armar(40, 'verificado', limpio, [caso('por-documentar')]), '2026-08-20').casos
    };
    // ── Los rasgos, con registros de mentira ─────────────────────────
    const fr = (ent, cxs) => (api.calcularCon({ posesion: '2026-08-07', categorias: { gobierno: {} }, entradas: ent,
      contradicciones: { casos: cxs || [] }, casos: { lista: [] } }, '2026-08-20').rasgos || []).map(x => x.id);
    const de = (n, categoria, tipo) => Array.from({ length: n }, (_, i) => ({ fecha: '2026-08-1' + (i % 9), categoria: categoria, tipoFuente: tipo || 'verificado' }));
    o.rasgosPrueba = {
      decretaSi: fr(de(6, 'gobierno').concat(de(4, 'ambiente'))),           // 60 % ≥ 30
      decretaNo: fr(de(2, 'gobierno').concat(de(8, 'ambiente'))),           // 20 % < 30
      disputadoSi: fr(de(2, 'ambiente', 'disputado').concat(de(8, 'ambiente'))), // 20 % ≥ 10
      disputadoNo: fr(de(1, 'ambiente', 'disputado').concat(de(19, 'ambiente'))), // 5 % < 10
      cambiaSi: fr(de(10, 'ambiente'), [cx('documentada'), cx('documentada')]),
      cambiaNo: fr(de(10, 'ambiente'), [cx('documentada')])
    };
    // ── La polémica ──────────────────────────────────────────────────
    // Si la función no existe (código viejo), que la prueba lo diga, no que reviente.
    const P = api.polemica || function () { return 0; };
    const ordenar = api.ordenar || function () { return 0; };
    o.polemica = {
      corrupcionSobreGobierno: P({ categoria: 'corrupcion' }) > P({ categoria: 'gobierno' }),
      disputadoSube: P({ categoria: 'gobierno', tipoFuente: 'disputado' }) > P({ categoria: 'gobierno', tipoFuente: 'verificado' }),
      contrapuntoSube: P({ categoria: 'gobierno', contrapunto: 'x' }) > P({ categoria: 'gobierno' }),
      // El comparador: fecha primero; dentro del día, polémica; luego el índice.
      orden: [{ e: { fecha: '2026-08-10', categoria: 'gobierno' }, i: 0 },
              { e: { fecha: '2026-08-10', categoria: 'corrupcion' }, i: 1 },
              { e: { fecha: '2026-08-11', categoria: 'gobierno' }, i: 2 },
              { e: { fecha: '2026-08-10', categoria: 'gobierno' }, i: 3 }]
        .sort(ordenar).map(x => x.i).join(',')
    };
    return o;
  });

  chk(r.hayApi, 'la ficha publica su cálculo para poder comprobarlo');
  chk(r.vista === 'ficha', 'el enlace profundo #/ficha-del-gobernante abre la ficha (' + r.vista + ')');

  const f = r.f || {};
  console.log('\n── Lo que muestra la ficha ─────────────────────────');
  console.log('  ' + f.hechos + ' hechos · ' + f.pct + ' % verificado · ' +
              f.contadas + '/' + f.revisados + ' cambios contados · ' + f.confirmados + ' confirmados · ' + f.veredicto +
              ' (manda: ' + (f.manda || []).join(', ') + ')');
  console.log('  rasgos: ' + (f.rasgos || []).join(', '));

  console.log('\n── Cada cifra, recontada aparte sobre el JSON ──────');
  [['hechos desde la posesión', 'hechos'], ['verificados', 'verificado'],
   ['disputados', 'disputado'], ['de una sola voz', 'declaracion'],
   ['porcentaje verificado', 'pct'], ['casos de postura revisados', 'revisados'],
   ['cambios que cuentan', 'contadas'], ['acusaciones desmentidas', 'desmentidas'],
   ['documentados que no cuentan', 'noCuentan'], ['frentes con hechos', 'frentes'],
   ['casos confirmados', 'confirmados'], ['casos en investigación', 'enInvestigacion'],
   ['señalamientos', 'senalamientos'], ['casos por documentar', 'porDocumentar'],
   ['el veredicto', 'veredicto']
  ].forEach(([nombre, k]) => {
    chk(f[k] === esperado[k], 'coincide ' + nombre + ' (ficha ' + f[k] + ' · recuento ' + esperado[k] + ')');
  });

  console.log('\n── La escalera del veredicto ───────────────────────');
  chk(JSON.stringify(r.escaleraApi) === JSON.stringify(IDS),
      'los cinco peldaños, de mejor a peor: ' + (r.escaleraApi || []).join(' › '));
  const p = r.pruebas || {};
  chk(p.inquebrantable === 'inquebrantable', 'limpio al 90 % y sin cambios → inquebrantable (' + p.inquebrantable + ')');
  chk(p.unCambio === 'fiable', 'un cambio de postura → como mucho fiable (' + p.unCambio + ')');
  chk(p.dosCambios === 'dudosa', 'dos → dudosa (' + p.dosCambios + ')');
  chk(p.tresCambios === 'poco-fiable', 'tres → poco fiable (' + p.tresCambios + ')');
  chk(p.pct80 === 'fiable' && p.pct60 === 'dudosa' && p.pct40 === 'poco-fiable',
      'el % verificado pone su techo: 80 → fiable, 60 → dudosa, 40 → poco fiable (' + [p.pct80, p.pct60, p.pct40].join(', ') + ')');
  chk(p.unConfirmado === 'poco-fiable', 'UN caso de corrupción confirmado, con todo lo demás limpio → poco fiable (' + p.unConfirmado + ')');
  chk(p.dosConfirmados === 'nada-fiable', 'dos confirmados → nada fiable (' + p.dosConfirmados + ')');
  chk(p.soloSenalamientos === 'inquebrantable',
      'señalamientos y por-documentar NO mueven el veredicto (' + p.soloSenalamientos + ')');
  chk(p.unaInvestigacion === 'dudosa', 'un caso EN INVESTIGACIÓN por una autoridad ya baja a dudosa (' + p.unaInvestigacion + ')');
  chk(p.dosInvestigaciones === 'poco-fiable', 'dos en investigación → poco fiable (' + p.dosInvestigaciones + ')');
  chk(p.confirmadoMandaSobreInv === 'poco-fiable', 'un confirmado más uno en investigación: manda el confirmado (' + p.confirmadoMandaSobreInv + ')');
  chk(p.peorDeTres === 'dudosa', 'el veredicto es el peor de los tres techos, no un promedio (' + p.peorDeTres + ')');
  chk(p.pocosHechos === 'sin-datos', 'con cuatro hechos no se califica a nadie (' + p.pocosHechos + ')');
  chk(p.pocosCasos === 'sin-datos', 'ni con un solo caso de postura revisado (' + p.pocosCasos + ')');
  chk(p.soloDesmentidas === 'inquebrantable',
      'cuatro acusaciones DESMENTIDAS no bajan el veredicto (' + p.soloDesmentidas + ')');
  chk(p.conCuentaFalse === 'inquebrantable',
      'y un caso marcado «no cuenta» no suma al veredicto (' + p.conCuentaFalse + ')');
  chk(p.porDocumentarOculto && p.porDocumentarOculto.porDocumentar === 1 && p.porDocumentarOculto.lista.length === 0,
      'un caso por documentar se cuenta como pendiente y no entra a la lista visible');

  console.log('\n── Los rasgos, por su cuenta y su umbral ───────────');
  const rp = r.rasgosPrueba || {};
  chk(rp.decretaSi && rp.decretaSi.includes('decreta') && rp.decretaNo && !rp.decretaNo.includes('decreta'),
      '«Gobierna por decreto» aparece al 60 % de actos de gobierno y no al 20 %');
  chk(rp.disputadoSi && rp.disputadoSi.includes('disputado') && rp.disputadoNo && !rp.disputadoNo.includes('disputado'),
      '«Bajo disputa» aparece al 20 % disputado y no al 5 %');
  chk(rp.cambiaSi && rp.cambiaSi.includes('cambia') && rp.cambiaNo && !rp.cambiaNo.includes('cambia'),
      '«Cambia de postura» aparece con dos cambios contados y no con uno');
  chk(r.rasgos.length === (f.rasgos || []).length && r.rasgos.length > 0,
      'los rasgos pintados son exactamente los que pasan su umbral (' + r.rasgos.length + ')');
  chk(r.rasgos.every(t => /\d+ de \d+ .*umbral: /.test(t)),
      'y cada uno dice cuántos de cuántos y cuál es el umbral');

  console.log('\n── La polémica ─────────────────────────────────────');
  const po = r.polemica || {};
  chk(po.corrupcionSobreGobierno, 'corrupción puntúa más que un acto de gobierno');
  chk(po.disputadoSube && po.contrapuntoSube, 'estar en disputa y tener contrapunto suben la polémica');
  chk(po.orden === '2,1,0,3', 'el comparador: fecha primero, luego polémica, luego el registro (' + po.orden + ')');

  console.log('\n── Lo que se ve, y en qué orden ────────────────────');
  const od = r.orden || {};
  const antes = (a, b) => od[a] != null && od[b] != null && od[a] < od[b];
  chk(antes('placa', 'casos') && antes('casos', 'cx') && antes('cx', 'rasgos') && antes('rasgos', 'serie') && antes('serie', 'metodo'),
      'orden de lectura: placa › casos de corrupción › contradicciones › rasgos › cómo va › método');
  chk(od.sen == null || od.cx == null || od.sen < od.cx, 'hasta los señalamientos van antes que las contradicciones');
  chk(od.conf == null || od.inv == null || od.conf < od.inv, 'y los confirmados antes que los en investigación');
  chk(od.inv == null || od.sen == null || od.inv < od.sen, 'y estos antes que los señalamientos');
  chk(od.cxPesa == null || od.cxNoPesa == null || od.cxPesa < od.cxNoPesa, 'en las contradicciones, primero las que cuentan');
  chk(r.ccPintados === esperado.visibles && r.ccPorEstado.pend === 0,
      'los casos de corrupción visibles salen todos y ningún por-documentar (' + r.ccPintados + ' de ' + esperado.visibles + ')');
  chk(r.cxPintados === esperado.revisados,
      'los casos de postura salen todos, contados y no contados (' + r.cxPintados + ')');
  chk(r.cxPesan === esperado.contadas,
      'y solo los que cuentan van marcados (' + r.cxPesan + ')');
  chk(/No cuenta: .*desmentida/.test(r.txt), 'dice por qué un caso desmentido no cuenta');
  chk(/No cuenta: .*hipocresía|No cuenta: .*no es señalamiento/.test(r.txt),
      'y por qué el caso marcado en el registro tampoco');
  chk(esperado.senalamientos === 0 || /No pesa en el veredicto/.test(r.txt),
      'cada señalamiento dice que no pesa');
  chk(esperado.enInvestigacion === 0 || /Pesa en el veredicto, menos que un confirmado/.test(r.txt),
      'y cada caso en investigación dice que pesa, menos que un confirmado');
  chk(r.escalera.length === 5 && r.escalera.filter(x => /\*$/.test(x)).length === 1,
      'la escalera marca un solo peldaño de cinco: ' + r.escalera.join(' · '));
  chk(/peor de los tres techos/.test(r.txt), 'dice en la cara que el veredicto es el peor de tres techos');
  chk(/No mide honestidad/.test(r.txt), 'y qué NO mide');
  chk(r.sinPeldanoViejo, 'ningún peldaño viejo (sostiene / reparos / entredicho) sobrevive en el DOM');
  chk(r.minPx >= 13, 'ningún texto corrido baja de 13 px en teléfono (mínimo ' + r.minPx + ' px)');
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
