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
    archivados: corr.filter(c => c.estado === 'archivado').length,
    porDocumentar: corr.filter(c => c.estado === 'por-documentar').length
  };
  esperado.conTipo = esperado.verificado + esperado.disputado + esperado.declaracion;
  esperado.pct = esperado.conTipo ? Math.round(100 * esperado.verificado / esperado.conTipo) : null;
  esperado.visibles = esperado.confirmados + esperado.enInvestigacion + esperado.senalamientos + esperado.archivados;
  // El veredicto, rehecho aquí con la MISMA regla escrita aparte.
  const techo = {
    // Confirmados: uno → poco fiable, dos → nada fiable. En investigación
    // (desde la v792 también pesan): uno → dudosa, dos → poco fiable.
    casos: (conf, inv) => Math.max(conf >= 2 ? 4 : conf >= 1 ? 3 : 0, inv >= 2 ? 3 : inv >= 1 ? 2 : 0),
    palabra: n => n >= 3 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0,
    claridad: p => p == null ? 0 : p < 50 ? 3 : p < 70 ? 2 : p < 85 ? 1 : 0
  };
  const IDS = ['inquebrantable', 'fiable', 'dudosa', 'poco-fiable', 'nada-fiable'];
  const ESCALERA_T = { 'inquebrantable': 'Confiabilidad inquebrantable', 'fiable': 'Fiable',
                       'dudosa': 'Dudosa', 'poco-fiable': 'Poco fiable', 'nada-fiable': 'Nada fiable' };
  /* El techo de la palabra se unifica con el eje A: lo que baja el peldaño es
     una contradicción documentada CON identidad de objeto verificada. Con la
     identidad sin declarar el techo no es un número sino un intervalo, y el
     veredicto solo se publica cuando las dos cotas coinciden —o sea cuando el
     dato que falta no puede cambiar la respuesta—.

     Va reimplementado acá, como el resto de la escalera: una prueba que
     importara la misma función no comprobaría nada más que que es igual a sí
     misma. */
  const docCuentan = casos.filter(c => c.estado === 'documentada' && c.cuenta !== false);
  esperado.conIdentidad = docCuentan.filter(c => c.mismoObjetoVerificado === true).length;
  esperado.sinIdentidad = docCuentan.filter(c => c.mismoObjetoVerificado === false).length;
  esperado.sinDeclararId = docCuentan.length - esperado.conIdentidad - esperado.sinIdentidad;
  const otros = Math.max(techo.casos(esperado.confirmados, esperado.enInvestigacion),
                         techo.claridad(esperado.pct));
  esperado.peorMin = Math.max(otros, techo.palabra(esperado.conIdentidad));
  esperado.peorMax = Math.max(otros, techo.palabra(esperado.conIdentidad + esperado.sinDeclararId));
  esperado.veredicto = (esperado.revisados < 3 || esperado.hechos < 20) ? 'sin-datos'
    : (esperado.peorMin !== esperado.peorMax ? 'sin-nivel' : IDS[esperado.peorMin]);

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
             /* SE DIO VUELTA en la v972: entre la placa y el muro entraron el
                bloque de gráficos y el enlace a la ficha completa. Se mide el
                ORDEN y no la distancia —«justo debajo» era una constante de la
                maquetación metida en la aserción—. */
             ordenPortada: ['sp-hero-ficha', 'sp-portada-graf', 'sp-ir-ficha', 'sp-acceso-muro']
               .map(id => hijos.indexOf(document.getElementById(id))),
             /* El héroe es el texto más grande de la página desde la v971 —lo
                primero que se lee es un hecho con fuente, no un veredicto
                calculado—, así que el veredicto es el mayor DE LA PLACA. */
             tamHeroe: (() => { const n = document.querySelector('.sp-heroe-n'); return n ? tam(n) : 0; })(),
             masGrandePlaca: Math.max(...Array.from(placa.querySelectorAll('*'))
               .filter(x => x.children.length === 0 && x.textContent.trim()).map(tam)),
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
    var o = portada.ordenPortada || [];
    chk(o.length === 4 && o.every((v, i) => v >= 0 && (!i || v > o[i - 1])) && portada.arribaDelTitulo,
        'y después van, en este orden, el bloque de gráficos, el enlace a la ficha y el muro (' +
        o.join(' · ') + ')');
    chk(!portada.botonViejo, 'el botón viejo de acceso a la ficha ya no está');
    chk(portada.anchoPct >= 95, 'ocupa el ancho de la columna (' + portada.anchoPct + '%)');
    chk(/casos? confirmados?/.test(portada.cuentas) && /en investigación/.test(portada.cuentas) &&
        /cambios? de postura/.test(portada.cuentas) && /% verificado|sin verificación/.test(portada.cuentas),
        'enseña las cuentas que producen el veredicto, con los casos en investigación');
    chk(portada.tamVeredicto >= portada.masGrandePlaca - 0.5,
        'el veredicto es el texto más grande de la placa (' + portada.tamVeredicto + ' px)');
    /* Y el de la PÁGINA es el héroe, que es un hecho con fuente. La aserción
       anterior pedía que el veredicto fuera el mayor de la portada, y eso dejó
       de ser cierto —y de ser deseable— el día que el bloque de gráficos subió:
       lo primero que se lee no es un juicio calculado sobre una persona. */
    chk(portada.tamHeroe > portada.tamVeredicto,
        'y el texto más grande de la página es el héroe, que es un hecho con fuente (' +
        portada.tamHeroe + ' contra ' + portada.tamVeredicto + ' px)');
    /* El tablero abre la rejilla desde la v971: lo primero es un HECHO con
       fuente y no un veredicto calculado. La ficha baja a 01 y el resto
       corre. Se pide el orden y la numeración corrida, que es lo que la
       aserción medía; citar los números viejos la volvía una constante del
       módulo metida en la comprobación (v890). */
    chk(/^00 /.test(portada.secs[0]) && /Tablero|Presupuesto|Hallazgos/i.test(portada.secs[0]) &&
        /^01 .*Ficha del gobernante/.test(portada.secs[1]) &&
        /^02 .*Contradicciones/.test(portada.secs[2]) &&
        portada.secs.every((t, i) => t.slice(0, 2) === String(i).padStart(2, '0')),
        'la rejilla va por polémica y numerada sin saltos, con el tablero abriendo (' +
        portada.secs.slice(0, 3).join(' · ') + ')');
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
    /* El DENOMINADOR de la claridad, leído de la placa (v842). Este módulo
       le reprocha a otras cifras andar sin denominador —el 62 % de firmas
       anuladas dice lo contrario de lo que pasó hasta que uno se entera de
       que a TODOS les anularon entre el 40 % y el 68 %—, así que su propia
       cifra principal, la que decide el veredicto sobre una persona, no
       puede salir sola. Un 100 % sobre tres hechos de cien no es un
       registro verificado: es un registro sin revisar con una cifra bonita
       encima, y desde la placa había que poder distinguirlos. */
    (function () {
      const filas = Array.from(document.querySelectorAll('#sp-ficha .sp-fi-techo'));
      const cl = filas.filter(x => /verificado/i.test(x.textContent))[0];
      const den = cl ? cl.querySelector('.sp-fi-techo-den') : null;
      o.claridad = {
        hayFila: !!cl,
        texto: cl ? cl.innerText.replace(/\s+/g, ' ').trim() : '',
        hayDen: !!den,
        den: den ? den.textContent.replace(/\s+/g, ' ').trim() : '',
        // Visible de verdad, no solo presente en el DOM.
        visible: !!(den && getComputedStyle(den).display !== 'none' && den.offsetHeight > 0)
      };
    })();
    /* El peldaño que NO se publica, leído del papel: la placa circula como
       captura, así que lo que hay que comprobar es lo que se ve en ella, no
       lo que devuelve la función. */
    (function () {
      const q = sel => { const n = document.querySelector(sel); return n ? n.innerText.replace(/\s+/g, ' ').trim() : null; };
      const filas = Array.from(document.querySelectorAll('#sp-ficha .sp-fi-techo'));
      const pal = filas.filter(x => /postura/i.test(x.textContent))[0];
      o.peldanoDom = {
        vval: q('#sp-ficha .sp-fi-vval'),
        vfalta: q('#sp-ficha .sp-fi-vfalta'),
        cuentas: q('#sp-ficha .sp-fi-cuentas'),
        falta: q('#sp-ficha .sp-fi-falta'),
        vnota: q('#sp-ficha .sp-fi-vnota'),
        techoPalabra: pal ? pal.innerText.replace(/\s+/g, ' ').trim() : null,
        // Ningún peldaño de la escalera puede salir marcado como el vigente.
        pasosOn: Array.from(document.querySelectorAll('#sp-ficha .sp-fi-paso.on')).map(n => n.textContent.trim())
      };
    })();
    const caja = document.getElementById('sp-ficha');
    o.txt = caja ? caja.innerText : '';
    /* El registro publicado declara los trece casos como nacionales, así que
       la ficha de verdad NO puede imprimir el aviso de nivel ni marcar ninguna
       tarjeta como fuera de la cuenta. Es la guarda contra pasarse de avisar:
       un aviso que sale siempre deja de significar algo. */
    o.nivelDOM = {
      aviso: !!(caja && caja.querySelector('.sp-fi-nivelaviso')),
      tarjetasFuera: caja ? caja.querySelectorAll('.sp-fi-cc-pesa-niv').length : -1,
      /* DENTRO de las tarjetas, no en la ficha entera: la introducción del
         panel explica la regla —«una decisión de nivel municipal… tampoco
         pesa»— y buscarla en todo el texto encuentra esa frase y no un caso
         rechazado. Es la lección de la v854 y la cazó esta misma aserción. */
      diceNivel: caja
        ? Array.from(caja.querySelectorAll('.sp-fi-cc-pesa'))
            .some(x => /decisi\u00f3n de nivel|no es uno de los cuatro/i.test(x.textContent))
        : true
    };
    if (caja) {
      o.rasgos = Array.from(caja.querySelectorAll('.sp-fi-rasgo')).map(x => x.innerText);
      /* La firma de la placa. Se lee el logo CARGADO —naturalWidth— y no que
         el `src` esté puesto: una ruta rota deja el atributo intacto y la
         imagen invisible, que es justo el fallo que no se vería hasta que
         alguien fotografía la placa. */
      (function () {
        const fi = caja.querySelector('.sp-fi-firma');
        const img = fi && fi.querySelector('img');
        const t = fi && fi.querySelector('.sp-fi-firma-t');
        const fe = fi && fi.querySelector('.sp-fi-firma-f');
        const w = fi && fi.querySelector('.sp-fi-firma-w');
        const cargo = caja.querySelector('.sp-fi-cargo');
        o.firma = {
          hay: !!fi,
          texto: t ? t.textContent : '',
          fecha: fe ? fe.textContent : '',
          // A la defensiva: contra la ficha anterior este renglón no existe.
          web: w ? w.textContent.trim() : '',
          // Y el punto que la separa del nombre lo pone el CSS: quien copia
          // el texto de la ficha se lleva dos cosas y no una frase pegada.
          webTexto: fi ? (fi.textContent || '') : '',
          logoCargo: !!(img && img.complete && img.naturalWidth > 0),
          // Arriba del cargo: es de quien analiza, no del analizado.
          antesDelCargo: !!(fi && cargo &&
            fi.getBoundingClientRect().top < cargo.getBoundingClientRect().top),
          altoPx: fi ? Math.round(fi.getBoundingClientRect().height) : 0
        };
      })();
      o.cxPintados = caja.querySelectorAll('.sp-fi-caso').length;
      o.cxPesan = caja.querySelectorAll('.sp-fi-caso.pesa').length;
      o.ccPintados = caja.querySelectorAll('.sp-fi-cc').length;
      ['conf', 'inv', 'sen', 'arch', 'pend'].forEach(k => { o.ccPorEstado[k] = caja.querySelectorAll('.sp-fi-cc-' + k).length; });
    // La etiqueta del archivado, leída en su propia tarjeta: el CSS la pone en
    // mayúsculas, así que se compara en minúsculas y por la tarjeta, no por el
    // texto de toda la hoja.
    o.tagsArch = Array.from(caja.querySelectorAll('.sp-fi-cc-arch .sp-tag'))
      .map(x => (x.className + '|' + x.textContent).toLowerCase());
    // La fecha que se lee en cada tarjeta, para cotejarla contra el registro.
    o.fechasCC = Array.from(caja.querySelectorAll('.sp-fi-cc')).map(x =>
      ((x.querySelector('h4') || {}).textContent || '').slice(0, 30) + ' → ' +
      ((x.querySelector('.sp-fi-cc-fecha') || {}).textContent || ''));
      o.escalera = Array.from(caja.querySelectorAll('.sp-fi-paso')).map(x => x.textContent + (x.classList.contains('on') ? '*' : ''));
      // El orden de lectura, por la CABECERA de cada sección.
      const y = sel => { const n = caja.querySelector(sel); return n ? n.getBoundingClientRect().top + window.scrollY : null; };
      const cab = t => { const h = Array.from(caja.querySelectorAll('.sp-fi-sech h3')).find(x => x.textContent.trim() === t); return h ? h.getBoundingClientRect().top + window.scrollY : null; };
      o.orden = { placa: y('.sp-fi-placa'), casos: cab('Casos de corrupción'), cx: cab('Contradicciones'),
                  rasgos: cab('Rasgos'), serie: cab('Cómo va'), metodo: cab('Método'),
                  conf: y('.sp-fi-cc-conf'), inv: y('.sp-fi-cc-inv'), sen: y('.sp-fi-cc-sen'),
                  arch: y('.sp-fi-cc-arch'),
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
            senalamientos: f.casos.senalamientos, archivados: f.casos.archivados,
            porDocumentar: f.casos.porDocumentar,
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
    /* Una contradicción documentada que baja el peldaño lleva su identidad de
       objeto DECLARADA: desde la v972 el techo `palabra` cuenta las que la
       tienen, así que una sin declarar ya no mide la escalera —deja la ficha
       sin peldaño, que es otra cosa y se mide aparte—. */
    const cxConId = () => ({ estado: 'documentada', tema: 't', mismoObjetoVerificado: true });
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
      unCambio: Vm(mixto90, limpio.concat([cxConId()])),
      // Dos → dudosa. Tres → poco fiable.
      dosCambios: Vm(mixto90, limpio.concat([cxConId(), cxConId()])),
      tresCambios: Vm(mixto90, limpio.concat([cxConId(), cxConId(), cxConId()])),
      // El % verificado pone su propio techo: 80 → fiable; 60 → dudosa; 40 → poco fiable.
      pct80: Vm(mixto(32, 8), limpio), pct60: Vm(mixto(24, 16), limpio), pct40: Vm(mixto(16, 24), limpio),
      // Un caso CONFIRMADO baja a poco fiable aunque todo lo demás esté limpio; dos, nada fiable.
      unConfirmado: Vm(mixto90, limpio, [caso('confirmado')]),
      dosConfirmados: Vm(mixto90, limpio, [caso('confirmado'), caso('confirmado')]),
      // Lo no confirmado NO mueve el veredicto.
      soloSenalamientos: Vm(mixto90, limpio, [caso('senalamiento'), caso('senalamiento'), caso('por-documentar')]),
      // Un caso que una autoridad ya archivó sin hallazgo tampoco mueve nada:
      // se muestra porque es parte del expediente, y exonera, no acusa.
      soloArchivados: Vm(mixto90, limpio, [caso('archivado'), caso('archivado'), caso('archivado')]),
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
    /* ── EL NIVEL DE GOBIERNO · la puerta al veredicto (v941) ──────────
       Hace falta fixture porque los TRECE casos de los dos registros de
       verdad son nacionales: contra el registro publicado la puerta no
       tiene nada que rechazar y las aserciones pasarían sin medir nada.
       El material de arriba también sirve de guarda: `caso()` NO declara
       nivel, así que todo lo que se comprobó hasta esta línea corre por la
       rama «sin declarar» y demuestra que la v941 no cambió el veredicto de
       ningún registro que no declare el campo. */
    const casoN = (estado, niv) => Object.assign(caso(estado), niv ? { nivelGobierno: niv } : {});
    const fN = (corr) => api.calcularCon(armar(40, 'verificado', limpio, corr), '2026-08-20');
    const resumen = (fx) => ({ v: fx.veredicto.id, confirmados: fx.casos.confirmados,
                               pesan: fx.casos.pesanConf + fx.casos.pesanInv,
                               fuera: fx.casos.fueraPorNivel, sin: fx.casos.sinNivel,
                               enLista: fx.casos.lista.length,
                               razon: (fx.casos.lista[0] || {}).puerta ? fx.casos.lista[0].puerta.razon : '?' });
    o.nivel = {
      nacional:    resumen(fN([casoN('confirmado', 'nacional')])),
      municipal:   resumen(fN([casoN('confirmado', 'municipal')])),
      distrital:   resumen(fN([casoN('confirmado', 'distrital')])),
      sinDeclarar: resumen(fN([casoN('confirmado')])),
      raro:        resumen(fN([casoN('confirmado', 'Municipal')])),
      // Uno nacional y uno municipal: el techo tiene que leer UNO, no dos.
      mezcla:      resumen(fN([casoN('confirmado', 'nacional'), casoN('confirmado', 'municipal')]))
    };
    /* La línea de la placa, que es lo que se lee de un vistazo debajo del
       veredicto. Tiene que contar lo que PESA: «1 caso confirmado» al lado de
       «inquebrantable» se lee como un error de la ficha. */
    o.nivelPlaca = {
      municipal: api.cuentas ? api.cuentas(fN([casoN('confirmado', 'municipal')])) : '(sin api.cuentas)',
      nacional:  api.cuentas ? api.cuentas(fN([casoN('confirmado', 'nacional')]))  : '(sin api.cuentas)'
    };
    /* ── CAPA 1 DEL PLIEGO · lo que describe, no lo que decide ─────────
       Hace falta fixture y no sirve el registro publicado: allá los 200
       hechos están clasificados y ninguno lleva contrargumento, así que la
       rama del valor desconocido y las dos ramas del contrargumento no se
       ejercitarían y las aserciones pasarían por no tener nada que rechazar.
       Es lo que este proyecto lleva veinte tandas persiguiendo. */
    const conC1 = (n, cp, tm, co) => Array.from({ length: n }, (_, i) => {
      const e = { fecha: '2026-08-1' + (i % 9), categoria: 'gobierno', tipoFuente: 'verificado' };
      if (cp) e.categoriaProbatoria = cp;
      if (tm) e.tipoMedicion = tm;
      if (co !== undefined) e.contrargumentoOficial = co;
      return e;
    });
    const fC1 = (ent) => api.calcularCon({ posesion: '2026-08-07', categorias: { gobierno: {} },
      entradas: ent, contradicciones: { casos: limpio }, casos: { lista: [] } }, '2026-08-20');

    const mezclaC1 = []
      .concat(conC1(10, 'hecho-probado', 'actividad'))
      .concat(conC1(6, 'correlacion', 'resultado'))
      .concat(conC1(4, 'atribucion-causal', 'contexto-estructural'))
      .concat(conC1(3, 'en-circulacion', 'actividad'))
      .concat(conC1(2, 'inventada', 'tampoco'))     // valores que la tabla no conoce
      .concat(conC1(5))                              // sin declarar
      .concat(conC1(4, 'hecho-probado', 'actividad', 'El Gobierno contestó esto.'))
      /* Con su CONSTANCIA de búsqueda desde la v961: un «ausente» a secas es
         el cuarto estado —afirma un silencio sin decir dónde se buscó— y
         tiene su propia aserción más abajo. Acá hacen falta seis que de
         verdad pesen, para que los tres estados se midan. */
      .concat(conC1(6, 'hecho-probado', 'actividad',
        { ausente: true, busco: ['Presidencia'], fecha: '2026-09-15' }));
    const c1 = (fC1(mezclaC1).capa1) || {};
    o.capa1 = { n: c1.n,
                prueba: c1.prueba, medicion: c1.medicion, contra: c1.contra };

    /* LA REGLA DE ORO, medida y no leída: dos registros idénticos salvo por
       los tres campos de la Capa 1 tienen que dar EL MISMO veredicto y los
       mismos tres techos. Si un día alguien mete la categoría probatoria en
       la escalera, el juicio público sobre una persona cambia por un campo
       que se agregó para describir — y esto se pone rojo antes. */
    const sinNada = conC1(40);
    const conTodo = []
      .concat(conC1(20, 'en-circulacion', 'contexto-estructural', 'ausente'))
      .concat(conC1(20, 'atribucion-causal', 'contexto-estructural'));
    const foto = (fx) => ({ v: fx.veredicto.id, manda: (fx.manda || []).join(','),
                            casos: fx.techos.casos.i, palabra: fx.techos.palabra.i,
                            claridad: fx.techos.claridad.i });
    o.oro = { sin: foto(fC1(sinNada)), con: foto(fC1(conTodo)) };

    /* ── CAPA 2 · los indicadores por 100 días ─────────────────────────
       Dos registros de mentira con la MISMA cantidad de hechos y distinta
       duración: es lo único que demuestra que la normalización hace algo. Con
       uno solo, una tasa mal calculada y una bien calculada se ven igual. */
    const regInd = (nHechos, posesion, corte, indic) => ({
      posesion: posesion, categorias: { gobierno: {} },
      entradas: Array.from({ length: nHechos }, (_, i) => Object.assign(
        { fecha: posesion, categoria: 'gobierno', tipoFuente: 'verificado',
          categoriaProbatoria: 'hecho-probado', tipoMedicion: i % 2 ? 'actividad' : 'resultado' },
        (indic && i < indic.length) ? { indicadores: indic[i] } : {})),
      contradicciones: { casos: [] }, casos: { lista: [] }
    });
    /* ── EL GATE DEL CRITERIO (v961) ────────────────────────────────
       Cuatro declaraciones de I-04 que ejercitan las cuatro salidas de la
       puerta: una que cuenta, una a la que le faltan los insumos, una de
       otro nivel de gobierno y una que los tiene y no cumple el criterio
       —un anuncio sin acto—. Sin las cuatro en la misma corrida, un gate
       que dejara pasar todo y uno que no dejara pasar nada se verían igual.

       Y va con su guarda de MATERIAL, porque el fixture es lo que hace que
       esto signifique algo: si las cuatro quedaran iguales, la comprobación
       pasaría sin tener nada que rechazar. */
    const VIA_OK = 'decreto expedido al amparo de una declaratoria de emergencia';
    /* La vía dice por CUÁL renglón del criterio entra; la base, en qué
       ENTRADA del registro está el acto. Cada hecho del fixture se nombra a
       sí mismo, que es el caso corriente. */
    const POR = (b) => ({ 'I-04': { via: VIA_OK, base: b } });
    const INSUMOS = [
      { id: 'h0', indicadores: ['I-04'], indicadoresPor: POR('h0'), nivelGobierno: 'nacional',
        estadoProcesal: 'en-firme', tipoEvidencia: 'documento-primario' },          // cuenta
      { id: 'h1', indicadores: ['I-04'], indicadoresPor: POR('h1') },                // sin insumos
      { id: 'h2', indicadores: ['I-04'], indicadoresPor: POR('h2'), nivelGobierno: 'municipal',
        estadoProcesal: 'en-firme', tipoEvidencia: 'documento-primario' },          // otro nivel
      { id: 'h3', indicadores: ['I-04'], indicadoresPor: POR('h3'), nivelGobierno: 'nacional',
        estadoProcesal: 'anunciado-sin-acto', tipoEvidencia: 'reporte-periodistico' }, // no cumple
      /* Las dos de la v963: sin decir por cuál renglón entra, y citando uno
         que el criterio no tiene. Sin las dos, un campo decorativo pasaría. */
      { id: 'h4', indicadores: ['I-04'], nivelGobierno: 'nacional',
        estadoProcesal: 'en-firme', tipoEvidencia: 'documento-primario' },          // sin vía
      { id: 'h5', indicadores: ['I-04'], indicadoresPor: { 'I-04': 'porque se me ocurrió' },
        nivelGobierno: 'nacional', estadoProcesal: 'en-firme',
        tipoEvidencia: 'documento-primario' },                                       // vía desconocida
      /* Las dos de la v964, que son la misma falta con dos causas: la vía es
         buena y el ACTO no está en el registro. La primera es la forma vieja
         —la vía a secas, sin base— y la segunda nombra una entrada que no
         existe, que es exactamente lo que le pasaba a I-13. */
      { id: 'h6', indicadores: ['I-04'], indicadoresPor: { 'I-04': VIA_OK },
        nivelGobierno: 'nacional', estadoProcesal: 'en-firme',
        tipoEvidencia: 'documento-primario' },                                       // sin base
      { id: 'h7', indicadores: ['I-04'], indicadoresPor: POR('no-esta-en-el-registro'),
        nivelGobierno: 'nacional', estadoProcesal: 'en-firme',
        tipoEvidencia: 'documento-primario' }                                        // base fantasma
    ];
    const regGate = {
      posesion: '2026-08-07', categorias: { gobierno: {} },
      entradas: INSUMOS.map((x, i) => Object.assign(
        { fecha: '2026-08-1' + i, categoria: 'gobierno', titulo: 'Hecho ' + i,
          tipoFuente: 'verificado', categoriaProbatoria: 'hecho-probado', tipoMedicion: 'actividad' }, x)),
      contradicciones: { casos: [] }, casos: { lista: [] }
    };
    const iG = api.indicadores(regGate, '2026-08-27');
    const f04 = iG.filas.filter(x => x.id === 'I-04')[0] || {};
    o.gate = {
      n: f04.n, declaradas: f04.declaradas,
      motivos: (f04.fuera || []).map(x => x.motivo).sort(),
      dichos: (f04.fuera || []).map(x => String(x.d || '').slice(0, 70)),
      tieneCriterio: !!f04.criterio,
      incluye: ((f04.criterio || {}).incluye || []).length,
      excluye: ((f04.criterio || {}).excluye || []).length,
      definicion: String((f04.criterio || {}).definicion || '').slice(0, 80),
      vias: f04.vias || [], porVia: f04.porVia || {},
      basesFuera: (f04.fuera || []).filter(x => x.motivo === 'sin-base-registrada')
                                   .map(x => String(x.d || '').slice(0, 64))
    };

    /* La marca de no validado. Se mide contra el registro REAL, que es donde
       tiene que salir: I-13 lo inventó este proyecto y no se ha podido correr
       contra ningún gobierno anterior. */
    const iR = api.indicadores();
    const vOf = (k) => (iR.filas.filter(x => x.id === k)[0] || {}).validacion || null;
    const v13 = vOf('I-13'), v04 = vOf('I-04');
    o.val = {
      i13: v13 ? { cat: v13.origenCategoria, urge: v13.urge, validado: v13.validado,
                   probados: v13.gobiernosAnterioresProbados, razon: String(v13.razon || '').slice(0, 80) } : null,
      i04: v04 ? { cat: v04.origenCategoria, urge: v04.urge, validado: v04.validado } : null,
      /* Los tres sin criterio no llevan marca: su cifra sale directa de la
         Capa 1 y no hay bordes dibujados por nadie que contrastar. */
      sinCriterio: ['I-06', 'I-09', 'I-10'].map(k => (vOf(k) ? k + ':marcado' : k + ':sin')).join(' '),
      n13: (iR.filas.filter(x => x.id === 'I-13')[0] || {}).n,
      vias13: ((iR.filas.filter(x => x.id === 'I-13')[0] || {}).vias) || [],
      fuera13: (((iR.filas.filter(x => x.id === 'I-13')[0] || {}).fuera) || []).map(x => x.motivo),
      /* Y en el PAPEL: la marca tiene que salir junto a la cifra, que es lo
         que se pidió. Medirla solo en el objeto dejaría pasar una marca
         calculada y no pintada. Las dos cuentas de al lado son la guarda de
         material: sin panel en el DOM, la de arriba no mide nada. */
      dom: Array.from(document.querySelectorAll('.sp-c2-noval')).map(x => x.textContent.slice(0, 400)),
      domFilas: document.querySelectorAll('.sp-c2-fila').length,
      domCrit: document.querySelectorAll('.sp-c2-crit').length
    };

    /* LA COBERTURA DE LA GUARDA DE ROL (v966). Una comprobación que no puede
       correr lo dice y se cuenta; si no, su exención se lee como que pasó. */
    const cr = iR.coberturaRol || {};
    const cbEl = document.querySelector('.sp-c2-cober');
    o.cober = {
      n: cr.n, corrio: cr.corrio, sinCorrer: cr.sinCorrer, por: cr.por,
      estados: (cr.casos || []).map(c => c.estado).sort(),
      dom: cbEl ? cbEl.textContent.slice(0, 2000) : '',
      domFalta: cbEl ? cbEl.className.indexOf('falta') >= 0 : false,
      /* Los casos que el recuento nombra, por su título. NO se pide uno por
         su nombre: el Decreto 1171 estaba escrito acá desde la v966 y al
         resolverlo esta aserción se puso roja por un cambio legítimo, que es
         la constante del material metida en la comprobación de la v890. Lo
         que hay que medir es la FORMA —que el recuento nombre los que no se
         pudieron comprobar, sean los que sean—, porque eso es lo que permite
         ir a mirar cuál es. */
      titulos: (cr.casos || []).filter(c => c.estado !== 'ok')
                               .map(c => String(c.titulo || '').slice(0, 90))
    };

    /* LA RAMA CON MATERIAL, SOBRE UN REGISTRO DE MENTIRA (v970). El registro
       de verdad quedó en cero: la v970 migró las veinte entradas de la forma
       antigua y quitó la declaración de las emisoras, así que las cinco que
       declaran indicador tienen su fuente del acto. Eso es lo que había que
       conseguir, y deja la rama de «no pudo correr» sin material.

       Medirla contra el registro real sería medir el número y no el
       mecanismo, que es justo lo que se puso rojo al mejorar el registro. Se
       mide contra cuatro entradas fabricadas, una por estado, que es lo que
       permite afirmar la pieza que decide: que `sin-acto` cuenta DENTRO de
       lo que corrió. Un `sin-acto` fuera de `corrio` volvería a empujar a
       declararlo `sin-declarar`, que miente.

       Lo que NO se puede medir acá es la redacción del DOM para esa rama:
       la ficha se pinta una vez, con el registro real, y abrirle una costura
       para repintarla con otro sería una puerta trasera de pruebas (v869).
       Eso lo comprueba `revisar.js`, exigiendo que las DOS redacciones estén
       escritas. */
    const F = (id, fu) => Object.assign(
      { fecha: '2026-09-01', titulo: 'Hecho de prueba ' + id, categoria: 'gobierno',
        tipoFuente: 'verificado', categoriaProbatoria: 'hecho-probado',
        tipoMedicion: 'actividad', indicadores: ['I-04'] }, fu);
    const regRol = {
      posesion: '2026-08-07', categorias: { gobierno: {} },
      contradicciones: { casos: [] }, casos: { lista: [] },
      entradas: [
        F('ok', { fuentes: [{ n: 'A', u: 'https://a', rol: 'efecto' },
                            { n: 'B', u: 'https://b', rol: 'acto' }] }),
        F('sinacto', { fuentes: [{ n: 'C', u: 'https://c', rol: 'efecto' }] }),
        F('sindeclarar', { fuentes: [{ n: 'D', u: 'https://d' }] }),
        F('vieja', { fuente: 'E', url: 'https://e' }),
        /* Y una que NO declara indicador, para que se vea que el denominador
           es la lista de declarantes y no el registro entero. */
        { fecha: '2026-09-01', titulo: 'Sin indicador', categoria: 'gobierno',
          tipoFuente: 'verificado', categoriaProbatoria: 'hecho-probado',
          tipoMedicion: 'actividad', fuentes: [{ n: 'F', u: 'https://f' }] }
      ]
    };
    const crF = (api.indicadores(regRol) || {}).coberturaRol || {};
    o.coberFix = {
      n: crF.n, corrio: crF.corrio, sinCorrer: crF.sinCorrer, por: crF.por,
      titulos: (crF.casos || []).filter(c => c.estado !== 'ok')
                                .map(c => String(c.titulo || ''))};

    /* `fichaDe` sin registro: caía en `{}` y devolvía un VEREDICTO sobre la
       nada —cero casos, cero contradicciones, peldaño de arriba—. Que la
       forma vacía y la real dieran lo mismo sería imposible, así que la
       aserción compara las dos. */
    const fSin = api.calcularCon();            // sin argumento
    const fVacio = api.calcularCon({ posesion: '2026-08-07', categorias: {}, entradas: [],
                                     contradicciones: { casos: [] }, casos: { lista: [] } });
    o.omision = { v: (fSin.veredicto || {}).id, vVacio: (fVacio.veredicto || {}).id };

    /* ── I-13 SOBRE EL REGISTRO DE VERDAD (v962) ──────────────────────
       Este indicador nació de que un caso real —la remoción del director del
       DANE— no cabía en I-05, porque el DANE no es un órgano autónomo. Así
       que la comprobación tiene que ser sobre el registro publicado y no
       sobre un fixture: lo que hay que saber es que el caso NO se pierde.

       Y las dos mitades: que I-13 lo recoja, y que I-05 siga en cero — si el
       caso volviera a contarse como choque entre poderes, el módulo estaría
       fabricando el señalamiento que esta separación evita. */
    const iReal = api.indicadores();
    const filaDe = (k) => (iReal.filas.filter(x => x.id === k)[0] || {});
    o.i13 = {
      n: filaDe('I-13').n, declaradas: filaDe('I-13').declaradas,
      i05n: filaDe('I-05').n, i05decl: filaDe('I-05').declaradas,
      i04n: filaDe('I-04').n,
      enOrden: iReal.filas.map(x => x.id).indexOf('I-13'),
      tieneCriterio: !!filaDe('I-13').criterio,
      cuentaCoincidencia: /coincidencia/i.test(String((filaDe('I-13').criterio || {}).definicion || '')),
      /* El eje B no puede haberlo absorbido: no tiene media histórica suya. */
      ejeBIds: (api.ejeB() || {}).filas ? (api.ejeB().filas || []).map(x => x.id) : []
    };

    /* LA CONSTANCIA DE BÚSQUEDA. `ausente` afirma que el Gobierno no
       respondió: con constancia es un dato y pesa en I-06; sin ella es un
       señalamiento sin respaldo, se ve y no pesa. Las dos ramas, porque una
       sola no distingue «no pesa nunca» de «pesa siempre». */
    const regContra = (co) => ({
      posesion: '2026-08-07', categorias: { gobierno: {} },
      entradas: [{ fecha: '2026-08-10', categoria: 'gobierno', titulo: 'Un hecho',
                   tipoFuente: 'verificado', categoriaProbatoria: 'hecho-probado',
                   tipoMedicion: 'actividad', contrargumentoOficial: co }],
      contradicciones: { casos: [] }, casos: { lista: [] }
    });
    const cCon = api.capaUno((regContra({ ausente: true, busco: ['Presidencia', 'MinInterior'],
                                          fecha: '2026-09-15' }).entradas));
    const cSin = api.capaUno(regContra('ausente').entradas);
    o.constancia = {
      con: { ausente: cCon.contra.ausente, sinConstancia: cCon.contra.sinConstancia },
      sin: { ausente: cSin.contra.ausente, sinConstancia: cSin.contra.sinConstancia }
    };

    const iA = api.indicadores(regInd(20, '2026-08-07', null, [['I-04'], ['I-04', 'I-05']]), '2026-08-27');
    const iB = api.indicadores(regInd(20, '2026-08-07'), '2027-08-07');
    o.ind = {
      cortoDias: iA.dias, cortoPor100: iA.por100Hechos, cortoPoder: iA.poder.id,
      largoDias: iB.dias, largoPor100: iB.por100Hechos, largoPoder: iB.poder.id,
      i04: (iA.filas.filter(x => x.id === 'I-04')[0] || {}),
      i05: (iA.filas.filter(x => x.id === 'I-05')[0] || {}),
      i06: (iA.filas.filter(x => x.id === 'I-06')[0] || {}),
      i09: (iA.filas.filter(x => x.id === 'I-09')[0] || {}),
      i10: (iA.filas.filter(x => x.id === 'I-10')[0] || {}),
      sinDeclarar: iA.sinDeclarar
    };

    /* La comparabilidad, medida sobre los DOS REGISTROS DE VERDAD, que es
       donde vive el hallazgo: uno es una bitácora diaria y el otro una
       selección de treinta y dos hechos de cuatro años. */
    const cmpReal = api.comparabilidad();
    o.cmp = { comparable: cmpReal.comparable, razones: cmpReal.razones,
              aHechos: cmpReal.a.hechos, aPor100: cmpReal.a.por100Hechos, aDias: cmpReal.a.dias,
              bHechos: cmpReal.b.hechos, bDias: cmpReal.b.dias,
              texto: (cmpReal.texto || '').slice(0, 900) };

    /* ── CAPA 3 · los tres ejes ────────────────────────────────────────
       El eje A necesita las dos ramas de `mismoObjetoVerificado` en la misma
       corrida: con todas sin declarar no se ve que el nivel se calcula, y con
       todas declaradas no se ve que sin declarar NO se publica. */
    const cxId = (id) => ({ estado: 'documentada', tema: 't' + id,
                            mismoObjetoVerificado: id === 'x' ? undefined : id });
    const regEjes = (cxs) => ({ posesion: '2026-08-07', categorias: { gobierno: {} },
      entradas: conC1(20, 'hecho-probado', 'actividad'),
      contradicciones: { casos: cxs }, casos: { lista: [] } });
    const ejesCon = api.ejes(regEjes([cxId(true), cxId(false), cxId(true)]), '2026-08-27');
    const ejesSin = api.ejes(regEjes([cxId(true), cxId('x')]), '2026-08-27');
    o.ejes = {
      n: ejesCon.length,
      letras: ejesCon.map(x => x.eje).join(''),
      aCon: { publicable: ejesCon[0].publicable, nivel: (ejesCon[0].nivel || {}).id,
              conId: ejesCon[0].conIdentidad, sinId: ejesCon[0].sinIdentidad,
              retoricas: ejesCon[0].tensionRetorica.length },
      aSin: { publicable: ejesSin[0].publicable, nivel: (ejesSin[0].nivel || {}).id,
              falta: (ejesSin[0].falta || '').slice(0, 130) },
      b: { publicable: ejesCon[1].publicable, nivel: (ejesCon[1].nivel || {}).id,
           filas: (ejesCon[1].filas || []).map(x => x.id).join(','),
           falta: (ejesCon[1].falta || '').slice(0, 130), lectura: (ejesCon[1].lectura || '').slice(0, 400) },
      c: { publicable: ejesCon[2].publicable, falta: (ejesCon[2].falta || '').slice(0, 130) },
      // Ningún eje trae un total, ni la lista lo trae colgado.
      totales: ejesCon.filter(x => x.total !== undefined || x.indice !== undefined).length
    };
    /* ── EL TECHO `palabra`, UNIFICADO CON EL EJE A ────────────────────
       La tensión que la v959 dejó declarada. Cuatro registros fabricados,
       porque contra el registro real ninguna de estas ramas se distingue: allá
       no hay una sola contradicción con identidad declarada, así que solo se
       ejercitaría la primera (v970 — medir el registro es medir el número).

       Los cuatro se diferencian en UNA cosa cada uno, que es lo que permite
       leer qué falló cuando falla. */
    // (a) documentada con la identidad SIN declarar → el techo es un intervalo.
    const vSinId = api.calcularCon(armar(40, 'verificado', limpio.concat([cx('documentada')])), '2026-08-20');
    // (b) declarada FALSE —tensión retórica—: no baja el peldaño, y se publica.
    const cxIdent = limpio.concat([Object.assign(cx('documentada'), { mismoObjetoVerificado: false })]);
    const vConId = api.calcularCon(armar(40, 'verificado', cxIdent), '2026-08-20');
    // (c) declarada TRUE: baja el peldaño, y se publica.
    const cxIdentSi = limpio.concat([Object.assign(cx('documentada'), { mismoObjetoVerificado: true })]);
    const vIdSi = api.calcularCon(armar(40, 'verificado', cxIdentSi), '2026-08-20');
    /* (d) sin declarar, pero con DOS confirmados: el intervalo entero queda por
       debajo de lo que ya fijan los otros dos techos, así que el dato que falta
       no puede cambiar la respuesta y el peldaño SÍ se publica.

       Es la única rama en la que esta versión se aparta de la lectura literal
       «mientras el eje A no publique nivel, la ficha tampoco», y va medida a
       propósito en vez de escondida: retener un veredicto que los casos de
       corrupción ya fijan solos sería callar por un motivo que no es suyo. */
    const vMandaCasos = api.calcularCon(
      armar(40, 'verificado', limpio.concat([cx('documentada')]), [caso('confirmado'), caso('confirmado')]),
      '2026-08-20');
    const leerV = v => ({ id: v.veredicto.id, det: v.determinado,
                          i: v.techos.palabra.i, iMax: v.techos.palabra.iMax,
                          ind: !!v.techos.palabra.indeterminado,
                          conId: v.techos.palabra.conIdentidad, sinDec: v.techos.palabra.sinDeclarar,
                          manda: (v.manda || []).join(','),
                          falta: ((v.ejeA || {}).falta || '').slice(0, 200),
                          d: (v.veredicto.d || '').slice(0, 420) });
    o.techoUnificado = { sinDeclarar: leerV(vSinId), idFalse: leerV(vConId),
                         idTrue: leerV(vIdSi), mandaCasos: leerV(vMandaCasos) };

    /* ── CAPA 4 · el marco, el editorial y el control ──────────────────
       Tres registros: sin editorial, con uno firmado que se apoya en una
       atribución causal, y con uno SIN firmar. Las tres ramas en la misma
       corrida, porque «no hay opinión» y «hay una opinión sin firma» son
       estados distintos y el segundo es el que hay que poder ver. */
    const regEd = (ed, marco) => Object.assign({
      posesion: '2026-08-07', categorias: { gobierno: {} },
      entradas: [
        { fecha: '2026-08-10', categoria: 'gobierno', titulo: 'Un hecho con documento',
          tipoFuente: 'verificado', categoriaProbatoria: 'hecho-probado', tipoMedicion: 'actividad',
          fuentes: [{ n: 'x', u: 'https://x' }] },
        { fecha: '2026-08-11', categoria: 'gobierno', titulo: 'Alguien atribuye una causa',
          tipoFuente: 'declaracion', categoriaProbatoria: 'atribucion-causal', tipoMedicion: 'contexto-estructural',
          fuentes: [{ n: 'y', u: 'https://y' }] }
      ],
      contradicciones: { casos: [] }, casos: { lista: [] }
    }, ed ? { analisisEditorial: ed } : {}, marco ? { marcoDeclarado: marco } : {});

    const edNo = api.editorial(regEd(null));
    const edSi = api.editorial(regEd({ autor: 'Fulano, editor', fecha: '2026-09-18',
      texto: 'Una postura.', registros: ['Alguien atribuye una causa', 'Un hecho con documento'] }));
    const edSinFirma = api.editorial(regEd({ texto: 'Una postura sin firma.', registros: [] }));
    const marSin = api.marco(regEd(null));
    const marCon = api.marco(regEd(null, { autor: 'Fulano', fecha: '2026-09-18',
      supuestos: ['considero que la inversión social es prioritaria'] }));
    o.capa4 = {
      edNo: { hay: edNo.hay, d: (edNo.d || '').slice(0, 400) },
      edSi: { hay: edSi.hay, firmado: edSi.firmado, apoyos: edSi.apoyos.length,
              flojos: edSi.flojos, huerfanos: edSi.huerfanos,
              clases: edSi.apoyos.map(a => (a.clase || {}).id).join(',') },
      edSinFirma: { hay: edSinFirma.hay, firmado: edSinFirma.firmado },
      marSin: { completo: marSin.completo, mide: marSin.mide.length, noMide: marSin.noMide.length,
                falta: (marSin.falta || '').slice(0, 400) },
      marCon: { completo: marCon.completo, supuestos: marCon.supuestos.length }
    };
    const cc = api.control(regEd(null), '2026-08-27');
    o.control = { n: cc.filas.length, pasan: cc.pasan, falla: cc.falla, sinCorrer: cc.sinCorrer,
                  limpio: cc.limpio,
                  fallan: cc.filas.filter(x => x.estado === 'falla').map(x => x.t.slice(0, 34)) };

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
   ['señalamientos', 'senalamientos'], ['casos archivados', 'archivados'],
   ['casos por documentar', 'porDocumentar'],
   ['el veredicto', 'veredicto']
  ].forEach(([nombre, k]) => {
    chk(f[k] === esperado[k], 'coincide ' + nombre + ' (ficha ' + f[k] + ' · recuento ' + esperado[k] + ')');
  });

  console.log('\n── La escalera del veredicto ───────────────────────');
  chk(JSON.stringify(r.escaleraApi) === JSON.stringify(IDS),
      'los cinco peldaños, de mejor a peor: ' + (r.escaleraApi || []).join(' › '));
  const p = r.pruebas || {};
  chk(p.inquebrantable === 'inquebrantable', 'limpio al 90 % y sin cambios → inquebrantable (' + p.inquebrantable + ')');
  chk(p.soloArchivados === 'inquebrantable',
      'tres casos archivados sin hallazgo NO bajan el veredicto (' + p.soloArchivados + ')');
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

  console.log('\n── El nivel de gobierno: qué entra al veredicto ────');
  const nv = r.nivel || {};
  // MATERIAL · el caso de prueba es un CONFIRMADO de verdad y se muestra. Sin
  // esto, «el municipal no pesa» podría estar pasando porque el caso no existe
  // o porque su estado no pesaba de todas formas.
  chk(nv.municipal && nv.municipal.confirmados === 1 && nv.municipal.enLista === 1,
      'MATERIAL · el caso municipal de prueba es un confirmado y SE MUESTRA entero (' +
      (nv.municipal || {}).confirmados + ' confirmado · ' + (nv.municipal || {}).enLista + ' en la lista)');
  chk(nv.nacional && nv.nacional.v === 'poco-fiable' && nv.nacional.pesa !== 0,
      'un caso confirmado NACIONAL pesa y baja el veredicto (' + (nv.nacional || {}).v + ')');
  chk(nv.municipal && nv.municipal.v === 'inquebrantable' && nv.municipal.pesan === 0 && nv.municipal.fuera === 1,
      'el mismo caso, declarado MUNICIPAL, no mueve el veredicto y se cuenta aparte (' +
      (nv.municipal || {}).v + ' · fuera ' + (nv.municipal || {}).fuera + ')');
  chk(nv.distrital && nv.distrital.v === 'inquebrantable' && nv.municipal.razon === 'otro-nivel',
      'lo mismo un distrital, y la razón que devuelve es la del nivel, no un false (' +
      (nv.municipal || {}).razon + ')');
  // La que de verdad guarda: sin el campo, NADA cambia respecto de la v940.
  chk(nv.sinDeclarar && nv.sinDeclarar.v === 'poco-fiable' && nv.sinDeclarar.fuera === 0 && nv.sinDeclarar.sin === 1,
      'un caso SIN declarar nivel sigue pesando como hasta ahora, y la ficha lo cuenta (' +
      (nv.sinDeclarar || {}).v + ' · sin declarar ' + (nv.sinDeclarar || {}).sin + ')');
  chk(nv.raro && nv.raro.v === 'inquebrantable' && nv.raro.razon === 'nivel-desconocido',
      'un nivel escrito con un valor que la ficha no conoce no pesa, y lo dice por su nombre (' +
      (nv.raro || {}).razon + ')');
  chk(nv.mezcla && nv.mezcla.confirmados === 2 && nv.mezcla.pesan === 1 && nv.mezcla.v === 'poco-fiable',
      'con uno nacional y uno municipal se muestran dos y pesa uno: «poco fiable», no «nada fiable» (' +
      (nv.mezcla || {}).confirmados + ' mostrados · ' + (nv.mezcla || {}).pesan + ' pesan · ' + (nv.mezcla || {}).v + ')');
  const np = r.nivelPlaca || {};
  chk(/^0 casos confirmados/.test(np.municipal || '') && /fuera de la cuenta por su nivel/.test(np.municipal || ''),
      'la línea de la placa cuenta los que PESAN y dice cuántos quedaron fuera («' +
      String(np.municipal).slice(0, 78) + '»)');
  chk(/^1 caso confirmado/.test(np.nacional || '') && !/fuera de la cuenta/.test(np.nacional || ''),
      'GUARDA · y con uno nacional dice uno, sin sobra ninguna («' + String(np.nacional).slice(0, 46) + '»)');

  console.log('\n── La Capa 1: qué clase de afirmación, qué mide, qué contestó el Gobierno ────');
  const c1 = r.capa1 || {}; const pr = c1.prueba || {}; const md = c1.medicion || {}; const co = c1.contra || {};
  console.log('  ' + JSON.stringify({ prueba: pr.por, sinDeclarar: pr.sinDeclarar, desconocidos: pr.desconocidos,
                                      medicion: md, contra: co }));
  // MATERIAL · sin las cuatro clases y sin las tres ramas de contrargumento en
  // el mismo registro, lo de abajo pasaría por no tener nada que contar.
  chk(c1.n === 40 && Object.keys(pr.por || {}).length === 4,
      'MATERIAL · el registro de prueba trae las cuatro categorías probatorias y 40 hechos (' +
      c1.n + ' hechos · ' + Object.keys(pr.por || {}).length + ' clases)');
  chk(pr.por && pr.por['hecho-probado'] === 20 && pr.por.correlacion === 6 &&
      pr.por['atribucion-causal'] === 4 && pr.por['en-circulacion'] === 3,
      'cuenta cada categoría probatoria por separado (' + JSON.stringify(pr.por) + ')');
  chk(pr.sinDeclarar === 5 && pr.desconocidos === 2,
      'y separa las que no declaran de las que traen un valor que no conoce (' +
      pr.sinDeclarar + ' sin declarar · ' + pr.desconocidos + ' desconocidos)');
  chk(md.actividad === 23 && md.resultado === 6 && md['contexto-estructural'] === 4 &&
      md.sinDeclarar === 5 && md.desconocidos === 2,
      'actividad, resultado y «ni una ni otra» se cuentan aparte y no se suman (' +
      md.actividad + ' · ' + md.resultado + ' · ' + md['contexto-estructural'] + ')');
  chk(co.respondio === 4 && co.ausente === 6 && co.sinRevisar === 30,
      'el contrargumento tiene TRES estados: respondió, no respondió, y nadie lo ha revisado (' +
      co.respondio + ' · ' + co.ausente + ' · ' + co.sinRevisar + ')');

  // La que de verdad guarda, y la razón por la que la Capa 1 se puede publicar.
  const oro = r.oro || {};
  chk(oro.sin && oro.con && JSON.stringify(oro.sin) === JSON.stringify(oro.con),
      'REGLA DE ORO · los tres campos NO mueven el veredicto ni ninguno de los tres techos (' +
      JSON.stringify(oro.sin) + ' contra ' + JSON.stringify(oro.con) + ')');

  console.log('\n── La Capa 2: los indicadores por 100 días ────');
  const ind = r.ind || {};
  console.log('  ' + JSON.stringify(ind));
  // MATERIAL · los dos registros tienen los MISMOS 20 hechos y duraciones
  // distintas. Sin eso, una tasa mal calculada se vería igual que una bien.
  chk(ind.cortoDias === 20 && ind.largoDias === 365,
      'MATERIAL · dos registros con los mismos 20 hechos y distinta duración (' +
      ind.cortoDias + ' días contra ' + ind.largoDias + ')');
  chk(ind.cortoPor100 === 100 && ind.largoPor100 === 5.5,
      'la misma cantidad de hechos da tasas distintas según los días de gobierno (' +
      ind.cortoPor100 + ' contra ' + ind.largoPor100 + ' por 100 días)');
  chk(ind.cortoPoder === 'bajo' && ind.largoPoder === 'medio',
      'y el poder predictivo sale de los días transcurridos, no de una opinión (' +
      ind.cortoPoder + ' · ' + ind.largoPoder + ')');
  /* Estas dos declaran indicador SIN los insumos del criterio, que es
     exactamente lo que el gate tiene que rechazar. Contra la v960 contaban
     2 y 1; ahora cuentan 0 y lo dicen. */
  chk(ind.i04 && ind.i04.n === 0 && ind.i04.declaradas === 2 &&
      ind.i05 && ind.i05.n === 0 && ind.i05.declaradas === 1,
      'una declaración sin los insumos del criterio no cuenta, y se dice cuántas se declararon (I-04 ' +
      (ind.i04 || {}).n + ' de ' + (ind.i04 || {}).declaradas + ')');

  console.log('\n── El criterio, como dato, y su puerta ──────────────');
  const gt = r.gate || {};
  console.log('  ' + JSON.stringify(gt));
  /* Son OCHO declaraciones en el fixture y llegan SIETE al criterio: la
     municipal la para `hechosDelMandato`, que desde la v971 filtra el nivel
     en la puerta del score. No es información perdida —el censo de
     publicación la cuenta y la nombra por su motivo—, es una puerta antes.
     Y la rama `otro-nivel` del criterio no queda muerta: `corridaHaciaAtras`
     lo llama sobre listas que NO pasan por esa puerta, y ahí sigue siendo la
     única que la rechaza. */
  chk(gt.declaradas === 7 && gt.motivos.length === 6,
      'MATERIAL · las declaraciones que llegan al criterio ejercitan sus seis salidas (' +
      gt.declaradas + ' declaradas · ' + gt.motivos.length + ' fuera)');
  chk(gt.n === 1,
      'solo la que cumple el criterio escrito cuenta (' + gt.n + ' de ' + gt.declaradas + ')');
  chk(String(gt.motivos) ===
        'no-cumple,sin-base-registrada,sin-base-registrada,sin-insumos,sin-via,via-desconocida',
      'y las otras seis salen con SU motivo, no con un rechazo genérico (' + gt.motivos.join(' · ') + ')');
  chk(gt.motivos.indexOf('otro-nivel') < 0 && gt.declaradas === 7,
      'la declaración municipal no llega siquiera al criterio: la para la puerta del score');
  chk(gt.basesFuera.length === 2 &&
      /no dice en qué entrada del registro/.test(gt.basesFuera.join(' ')) &&
      /no está en el registro: nombra la entrada/.test(gt.basesFuera.join(' ')),
      'y las dos maneras de no tener base se dicen distinto: falta el campo, o falta el hecho (' +
      gt.basesFuera.join(' | ') + ')');

  /* ── LA MARCA DE NO VALIDADO (v964) ─────────────────────────────────────
     I-13 lo inventó este proyecto despues de ver el caso que necesitaba
     capturar. Mientras no se pueda correr contra el registro clasificado de
     un gobierno anterior, la cifra sale con esa advertencia AL LADO. */
  const vl = r.val || {};
  console.log('  validacion: ' + JSON.stringify(vl).slice(0, 320));
  chk(vl.i13 && vl.i13.cat === 'construida-para-el-caso' && vl.i13.urge === true,
      'MATERIAL · I-13 declara que su categoría se construyó para el caso, y es la que urge (' +
      ((vl.i13 || {}).cat || 'sin declarar') + ')');
  chk(vl.i13 && vl.i13.validado === false && vl.i13.probados === 0,
      'y sale marcado como NO validado, con los gobiernos anteriores probados en cero (' +
      JSON.stringify(vl.i13 && { v: vl.i13.validado, p: vl.i13.probados }) + ')');
  chk(vl.i13 && /no hay material|no pasaron por esta clasificaci|ning[uú]n registro/i.test(vl.i13.razon),
      'y la razon distingue «no dispara» de «no hay material» (' + ((vl.i13 || {}).razon || '') + ')');
  /* Se dio vuelta en la v965. La v964 dejaba a I-04 sin marca razonando que
     ponerla en todos la mataría; el criterio de I-04 tampoco está contrastado
     —se escribió leyendo este registro— así que no marcarlo sugiere que sí.
     Lo que salva la marca es que las dos no digan lo mismo. */
  chk(vl.i04 && vl.i04.validado === false && vl.i04.cat === 'juridica-preexistente' &&
      vl.i04.urge === false,
      'un criterio del pliego también sale sin validar, pero con la gravedad menor (' +
      JSON.stringify(vl.i04) + ')');
  chk(vl.sinCriterio === 'I-06:sin I-09:sin I-10:sin',
      'y los tres SIN criterio no llevan marca: no hay bordes que contrastar (' + vl.sinCriterio + ')');
  chk(vl.domFilas >= 5 && vl.domCrit >= 3,
      'MATERIAL · el panel de la Capa 2 está compuesto en el DOM (' +
      vl.domFilas + ' filas · ' + vl.domCrit + ' criterios)');
  chk((vl.dom || []).length === 4 && (vl.dom || []).every(x => /validado: no/.test(x)) &&
      (vl.dom || []).every(x => /gobiernos anteriores probados: 0/.test(x)),
      'y las cuatro marcas estan en el papel, junto a su cifra, no en una nota (' +
      (vl.dom || []).length + ')');
  chk((vl.dom || []).filter(x => /construida para el caso/.test(x)).length === 1 &&
      (vl.dom || []).filter(x => /preexistente/.test(x)).length === 3,
      'y no dicen lo mismo: una nombra la categoria construida y tres la preexistente (' +
      (vl.dom || []).filter(x => /construida para el caso/.test(x)).length + ' · ' +
      (vl.dom || []).filter(x => /preexistente/.test(x)).length + ')');

  /* ── LA EXENCIÓN DE LA GUARDA DE ROL SE VE (v966) ───────────────────────
     Veinte entradas usan la forma antigua y no pueden llevar rol, así que la
     guarda de la v965 no corre sobre ellas. Eso estaba en la bitácora y no
     en la ficha: desde la pantalla se leía como que había pasado. */
  const cb = r.cober || {};
  console.log('  cobertura de rol: ' + JSON.stringify({ n: cb.n, corrio: cb.corrio,
    sinCorrer: cb.sinCorrer, por: cb.por, titulos: cb.titulos }));
  const cf = r.coberFix || {};
  console.log('  cobertura de rol (fixture): ' + JSON.stringify(cf));

  /* ── LA RAMA CON MATERIAL, SOBRE EL FIXTURE (v970) ──────────────────────
     Hasta la v967 esto medía el registro REAL y pedía que hubiera entradas
     sin comprobar. La v970 las quitó —migró las veinte y retiró la
     declaración de las emisoras— y la aserción se puso roja sobre un
     registro que había mejorado: señal de que medía el número y no el
     mecanismo. El mecanismo se mide contra cuatro entradas fabricadas, una
     por estado, y sobrevive a que el registro se limpie del todo. */
  chk(cf.n === 4 && (cf.por || {}).ok === 1 && (cf.por || {})['sin-acto'] === 1 &&
      (cf.por || {})['sin-declarar'] === 1 &&
      (cf.por || {})['no-comprobable-esquema-antiguo'] === 1,
      'MATERIAL · el fixture ejercita los cuatro estados, uno cada uno (' +
      JSON.stringify(cf.por) + ')');
  /* LA PIEZA QUE DECIDE (v970). `sin-acto` cuenta DENTRO de lo que corrió:
     la comprobación SÍ se hizo y su resultado fue que ninguna fuente
     documenta el acto. Si cayera en `sinCorrer`, volvería la presión de la
     v967 —declararlo `sin-declarar` para no poner la corrida en rojo—, que
     dice «nadie escribió el rol» donde lo cierto es otra cosa. */
  chk(cf.corrio === 2 && cf.sinCorrer === 2,
      'y «sin acto» cuenta como CORRIDA, no como comprobacion que no se pudo hacer (' +
      cf.corrio + ' corrieron de ' + cf.n + ' · ' + cf.sinCorrer + ' sin correr)');
  chk((cf.titulos || []).length === 3 &&
      (cf.titulos || []).some(x => /sinacto/.test(x)),
      'y el recuento nombra los tres que no son «ok», el sin-acto entre ellos (' +
      (cf.titulos || []).join(' | ') + ')');
  chk(cf.n === 4,
      'el denominador son las que declaran indicador, no el registro entero (4 de 5 entradas)');

  /* ── Y EL REGISTRO REAL, QUE HOY ESTÁ EN CERO ──────────────────────────
     Es la afirmación que la v970 compró: antes de migrar, la ficha decía
     que en una de cinco la comprobación no había podido correr. Ahora dice
     que corrió sobre todas, y eso es cierto. La guarda es contra pasarse de
     avisar por el otro lado: con cero material, la ficha no puede marcarse
     en falta ni nombrar a nadie. */
  chk(cb.n >= 4 && cb.sinCorrer === 0 && cb.corrio === cb.n,
      'en el registro real la comprobacion corre sobre TODAS las declarantes (' +
      cb.corrio + ' de ' + cb.n + ')');
  /* Las tres de abajo se dieron vuelta al migrar las veinte entradas de la
     forma antigua. La v966 medía que el Decreto 1171 estuviera EXENTO por su
     esquema; ahora lo que hay que medir es que ya no lo esté, y que ninguna
     otra lo esté tampoco — es la misma propiedad por el otro lado, como la
     v876 con la estructura de edades y la v887 con los marcos a trazos.
     La que manda es la primera: sin ella, devolver una entrada a `fuente` +
     `url` volvería a apagar la guarda de rol sin que nadie se enterara. */
  chk((cb.por || {})['no-comprobable-esquema-antiguo'] === 0,
      'ninguna entrada declarante queda exenta por esquema antiguo: la migracion no se deshace (' +
      JSON.stringify(cb.por) + ')');
  chk((cb.titulos || []).length === cb.sinCorrer,
      'el recuento nombra uno por uno los casos que no se pudieron comprobar (' +
      (cb.titulos || []).length + ' nombrados de ' + cb.sinCorrer + ' sin correr)');
  /* Las CUATRO CASILLAS SIGUEN EXISTIENDO aunque hoy las tres que no son
     «ok» estén en cero: fundirlas en un «falta algo» sería perder la
     distinción entre «ninguna fuente documenta el acto», «nadie escribió el
     rol» y «hay que migrar el esquema», que piden tres tareas distintas.
     Que estén en cero es el resultado de la v970 y no una guarda sin
     material: el mecanismo lo ejercita el fixture de arriba, una por
     casilla, y la rama de la forma antigua la vigila además `revisar.js`. */
  chk(['ok', 'sin-acto', 'sin-declarar', 'no-comprobable-esquema-antiguo']
        .every(k => typeof (cb.por || {})[k] === 'number') &&
      (cb.por || {}).ok === cb.n,
      'las cuatro causas se siguen contando aparte, hoy todas en la de «ok» (' +
      JSON.stringify(cb.por) + ')');
  chk(/comprobada en \d+ de \d+/.test(cb.dom || '') &&
      /corrió sobre todas/.test(cb.dom || '') && cb.domFalta === false,
      'y la ficha lo dice con su recuento: corrio sobre todas, sin marca de falta (' +
      String(cb.dom || '').slice(0, 80) + ')');
  /* LA GUARDA CONTRA PASARSE DE AVISAR, que es la que de verdad protege hoy:
     con cero sin comprobar, la ficha no puede nombrar a nadie. Un nombre ahí
     sería una entrada señalada por una exención que ya no tiene. */
  chk((cb.titulos || []).length === 0 && !/sin fuente del acto/.test(cb.dom || '') &&
      !/roles sin declarar/.test(cb.dom || ''),
      'y no nombra a ninguna, porque hoy no hay ninguna que nombrar (' +
      ((cb.titulos || []).join(' | ') || 'ninguna') + ')');
  chk(vl.n13 === 1 && (vl.vias13 || []).length === 1,
      'I-13 cuenta 1 y entra por una sola via, ahora que su acto esta registrado (' +
      vl.n13 + ' · ' + (vl.vias13 || []).join(' · ').slice(0, 60) + ')');
  chk(gt.vias.length === 1 && gt.porVia[gt.vias[0]] === 1,
      'y la que cuenta queda contada POR SU RENGLÓN del criterio, no en un montón (' +
      gt.vias.join(' · ') + ')');

  const om = r.omision || {};
  console.log('  fichaDe sin registro: ' + JSON.stringify(om));
  /* MATERIAL de esta pareja: un registro vacío SÍ da el peldaño de arriba, y
     eso es lo que hacía peligroso el `{}` por omisión. Sin esta mitad, la de
     abajo podría pasar porque los dos dan lo mismo. */
  /* MATERIAL medido y no supuesto: un registro vacío da «sin datos» —los
     mínimos de la v791 impiden dictaminar sin casos ni hechos—, NO el peldaño
     de arriba. Así que el `{}` por omisión daba una ficha muda y no un
     veredicto falso; se arregla igual, porque medía la nada teniendo el
     registro al lado. */
  chk(om.vVacio === 'sin-datos',
      'MATERIAL · un registro vacío da «sin datos», no un veredicto (' + om.vVacio + ')');
  chk(om.v && om.v !== om.vVacio,
      'y calcularCon() sin argumento mide el registro real, no ese vacío (' + om.v + ')');
  chk((gt.dichos || []).every(x => x.length > 12),
      'cada rechazo dice qué le falta a ESA entrada, no solo que no pasó');
  chk(gt.tieneCriterio && gt.incluye >= 3 && gt.excluye >= 3 && gt.definicion.length > 30,
      'el indicador publica su criterio con la definición y las dos listas (' +
      gt.incluye + ' incluye · ' + gt.excluye + ' excluye)');

  console.log('\n── I-13: el caso que no cabía en I-05 ─────────────────');
  const t13 = r.i13 || {};
  console.log('  ' + JSON.stringify(t13));
  chk(t13.declaradas === 1 && t13.n === 1,
      'MATERIAL · el registro real declara el caso en I-13 y cumple su criterio (' +
      t13.n + ' de ' + t13.declaradas + ')');
  chk(t13.i05n === 0 && t13.i05decl === 0,
      'y NO se cuenta como choque con un órgano autónomo: el DANE no lo es (I-05 ' + t13.i05n + ')');
  chk(t13.tieneCriterio && t13.cuentaCoincidencia === true,
      'su criterio dice que cuenta una COINCIDENCIA documentada, no una causa probada');
  chk(t13.enOrden >= 0,
      'la ficha lo publica como una fila más del cuadro de indicadores');
  chk((t13.ejeBIds || []).length > 0 && (t13.ejeBIds || []).indexOf('I-13') < 0,
      'y el eje B no lo absorbe: sin media histórica suya, compararía cuatro contra una ' +
      'referencia y el quinto contra nada (' + (t13.ejeBIds || []).join(',') + ')');

  const cs = r.constancia || {};
  console.log('  constancia: ' + JSON.stringify(cs));
  chk(cs.con && cs.con.ausente === 1 && cs.con.sinConstancia === 0,
      'un «ausente» con dónde se buscó y cuándo es un dato y pesa');
  chk(cs.sin && cs.sin.ausente === 0 && cs.sin.sinConstancia === 1,
      'y uno sin constancia se ve como tal y NO pesa: afirmar un silencio sin respaldo es un señalamiento');
  chk(ind.i09 && ind.i09.n === 10 && ind.i10 && ind.i10.n === 10 && ind.i09.n === ind.i10.n,
      'PRINCIPIO 5 · actividad y resultado se cuentan en renglones distintos y no se suman (' +
      (ind.i09 || {}).n + ' actividad · ' + (ind.i10 || {}).n + ' resultados)');
  // La que guarda: un cero en I-06 diría que el Gobierno respondió a todo.
  chk(ind.i06 && ind.i06.sinCalcular === true && /sin revisar/.test(ind.i06.razon || ''),
      'I-06 no se publica como cero mientras haya hechos sin revisar, y dice por qué (' +
      String((ind.i06 || {}).razon).slice(0, 60) + ')');

  const cpb = r.cmp || {};
  console.log('  comparabilidad: ' + JSON.stringify({ comparable: cpb.comparable, razones: cpb.razones,
    a: cpb.aHechos + ' en ' + cpb.aDias + ' d = ' + cpb.aPor100 + '/100d', b: cpb.bHechos + ' en la misma ventana' }));
  chk(cpb.comparable === false && (cpb.razones || []).length > 0,
      'las dos tasas NO se declaran comparables, y se dice por qué (' + (cpb.razones || []).join(', ') + ')');
  chk(cpb.aDias === cpb.bDias,
      'el registro del otro gobierno se recorta a los MISMOS días desde su posesión (' +
      cpb.aDias + ' contra ' + cpb.bDias + ')');
  chk(/no son la misma clase de objeto/.test(cpb.texto || '') &&
      /es de los registros, no de los gobiernos/.test(cpb.texto || ''),
      'y el texto nombra la causa real: los dos registros no son la misma clase de objeto');

  console.log('\n── La Capa 3: los tres ejes, lado a lado ────');
  const ej = r.ejes || {};
  console.log('  ' + JSON.stringify(ej));
  chk(ej.n === 3 && ej.letras === 'ABC',
      'MATERIAL · son TRES ejes y salen en orden A, B, C (' + ej.n + ' · ' + ej.letras + ')');
  chk(ej.totales === 0,
      'ninguno trae un total ni un índice general: nunca se combinan en un número (' + ej.totales + ')');
  chk(ej.aCon && ej.aCon.publicable === true && ej.aCon.conId === 2 && ej.aCon.sinId === 1 &&
      ej.aCon.retoricas === 1,
      'EJE A · con la identidad de objeto declarada sale nivel, y la tensión retórica se cuenta aparte (' +
      (ej.aCon || {}).nivel + ' · ' + (ej.aCon || {}).conId + ' con identidad · ' +
      (ej.aCon || {}).sinId + ' retóricas)');
  chk(ej.aSin && ej.aSin.publicable === false && !ej.aSin.nivel &&
      /MISMO objeto verificado/.test(ej.aSin.falta || ''),
      'y con una sin declarar NO publica nivel, y dice qué falta (' +
      String((ej.aSin || {}).falta).slice(0, 70) + ')');
  chk(ej.b && ej.b.publicable === false && ej.b.filas === 'I-04,I-05,I-07,I-06' &&
      /Petro, Duque y Santos/.test(ej.b.falta || ''),
      'EJE B · trae sus cuatro indicadores y NO publica nivel sin la media histórica (' +
      (ej.b || {}).filas + ')');
  chk(ej.b && /no elige la lectura/.test(ej.b.lectura || ''),
      'y dice que el número se lee en las dos direcciones y que el módulo no elige');
  chk(ej.c && ej.c.publicable === false && /deflactada/.test(ej.c.falta || ''),
      'EJE C · declarado con la fuente entera que le falta, no sacado de los titulares');

  /* ── EL TECHO `palabra`, UNIFICADO CON EL EJE A ──────────────────────
     Esta aserción SE DIO VUELTA, como las dos de la v876. Hasta la v971 decía
     que declarar la identidad de objeto NO movía el veredicto —era cierto, y
     era el defecto: el techo contaba todas las contradicciones documentadas
     mientras el eje A solo las que tienen identidad, y la ficha publicaba
     «Poco fiable» sobre un presidente en ejercicio con esa lectura pendiente—.
     Ahora lo que tiene que fallar es justo lo que antes tenía que pasar. */
  const tu = r.techoUnificado || {};
  console.log('\n── El techo de la palabra, unificado con el eje A ────');
  Object.keys(tu).forEach(k => console.log('  ' + k + ': ' + JSON.stringify(tu[k])));

  chk(tu.sinDeclarar && tu.idFalse && tu.idTrue && tu.mandaCasos &&
      tu.sinDeclarar.sinDec === 1 && tu.idFalse.sinDec === 0 && tu.idTrue.conId === 1,
      'MATERIAL · los cuatro registros se distinguen en la identidad de objeto (' +
      [tu.sinDeclarar, tu.idFalse, tu.idTrue].map(x => (x || {}).conId + '/' + (x || {}).sinDec).join(' · ') + ')');

  chk(tu.sinDeclarar && tu.sinDeclarar.id === 'sin-nivel' && tu.sinDeclarar.det === false &&
      tu.sinDeclarar.ind === true && tu.sinDeclarar.i === 0 && tu.sinDeclarar.iMax === 1,
      'con la identidad SIN declarar no se publica peldaño: el techo es un intervalo (' +
      (tu.sinDeclarar || {}).id + ' · ' + (tu.sinDeclarar || {}).i + '–' + (tu.sinDeclarar || {}).iMax + ')');

  chk(tu.sinDeclarar && /entre «/.test(tu.sinDeclarar.d) && /sin sus insumos/.test(tu.sinDeclarar.d) &&
      /MISMO objeto verificado/.test(tu.sinDeclarar.falta || ''),
      'y dice entre qué dos peldaños queda y qué falta para decidirlo');

  chk(tu.idFalse && tu.idFalse.id === 'inquebrantable' && tu.idFalse.det === true && tu.idFalse.ind === false,
      'declarada como tensión retórica —identidad FALSE— no baja el peldaño, y el veredicto se publica (' +
      (tu.idFalse || {}).id + ')');

  chk(tu.idTrue && tu.idTrue.id === 'fiable' && tu.idTrue.det === true && tu.idTrue.i === 1,
      'declarada con identidad TRUE sí lo baja, y el veredicto se publica (' + (tu.idTrue || {}).id + ')');

  /* La rama medida donde el dato que falta no puede cambiar la respuesta. Sin
     ella, la regla sería «no se publica nunca que haya una identidad sin
     declarar», y un veredicto que los casos de corrupción fijan solos se
     callaría por un motivo que no es suyo. */
  chk(tu.mandaCasos && tu.mandaCasos.id === 'nada-fiable' && tu.mandaCasos.det === true &&
      tu.mandaCasos.ind === true && tu.mandaCasos.sinDec === 1,
      'con dos confirmados el intervalo no puede cambiar la respuesta, y el peldaño SÍ se publica (' +
      (tu.mandaCasos || {}).id + ')');

  /* Y sobre el registro REAL, leído del papel. */
  const pd = r.peldanoDom || {};
  console.log('  DOM: ' + JSON.stringify(pd).slice(0, 460));
  chk(pd.vval === 'Sin nivel' && (pd.pasosOn || []).length === 0,
      'la ficha publicada NO enseña peldaño de fiabilidad: dice «Sin nivel» y ningún paso marcado (' +
      pd.vval + ' · ' + (pd.pasosOn || []).join(',') + ')');
  chk(/Falta declarar/.test(pd.vfalta || '') && /mismo objeto verificado/.test(pd.vfalta || ''),
      'y la PLACA —que circula recortada— dice qué falta para calcularlo');
  chk(/sin identidad de objeto declarada/.test(pd.cuentas || ''),
      'la línea de cuentas no enseña los cambios de postura como si se pudieran usar');
  chk(/Qué falta para calcularlo/.test(pd.falta || '') && /mismoObjetoVerificado/.test(pd.falta || ''),
      'y la ficha dice cómo se consigue, no solo que falta');
  chk(/entre «/.test(pd.techoPalabra || '') && !/como mucho/.test(pd.techoPalabra || ''),
      'el techo indeterminado se dibuja como intervalo y no como «como mucho X» (' +
      String(pd.techoPalabra || '').slice(0, 110) + ')');

  console.log('\n── La Capa 4: el marco, el editorial y el control ────');
  const c4 = r.capa4 || {};
  console.log('  ' + JSON.stringify(c4));
  chk(c4.marSin && c4.marSin.mide === 3 && c4.marSin.noMide === 3,
      'MATERIAL · el marco declara tres cosas que mide y tres que no (' +
      (c4.marSin || {}).mide + ' · ' + (c4.marSin || {}).noMide + ')');
  chk(c4.marSin && c4.marSin.completo === false && /neutralidad falsa/.test(c4.marSin.falta || ''),
      'sin supuestos de valor declarados el marco NO se da por completo, y dice por qué');
  chk(c4.marCon && c4.marCon.completo === true && c4.marCon.supuestos === 1,
      'GUARDA · con los supuestos declarados sí queda completo (' + (c4.marCon || {}).supuestos + ')');
  chk(c4.edNo && c4.edNo.hay === false && /sin firma/.test(c4.edNo.d || ''),
      'sin editorial la sección lo dice y nombra lo que NO sería legítimo (' +
      String((c4.edNo || {}).d).slice(0, 62) + ')');
  chk(c4.edSi && c4.edSi.hay === true && c4.edSi.firmado === true && c4.edSi.apoyos === 2 &&
      c4.edSi.huerfanos === 0,
      'un editorial firmado enlaza sus registros de apoyo (' + (c4.edSi || {}).apoyos + ' apoyos)');
  // La marca que el pliego pide en la interfaz.
  chk(c4.edSi && c4.edSi.flojos === 1 && /atribucion-causal/.test(c4.edSi.clases || ''),
      'y se MARCA cuando se apoya en una atribución causal o en algo que solo circula (' +
      (c4.edSi || {}).flojos + ' marcado de ' + (c4.edSi || {}).apoyos + ')');
  chk(c4.edSinFirma && c4.edSinFirma.hay === true && c4.edSinFirma.firmado === false,
      'y una opinión sin autor ni fecha se ve como tal, en vez de pasar por firmada');

  const cq = r.control || {};
  console.log('  control: ' + JSON.stringify(cq));
  chk(cq.n >= 10 && cq.falla > 0 && cq.limpio === false,
      'el control de calidad del pliego FALLA donde tiene que fallar y no se da por limpio (' +
      cq.falla + ' fallan de ' + cq.n + ')');
  chk(cq.sinCorrer > 0,
      'y los casilleros que no se pueden correr se dicen como tales, no se dan por buenos (' +
      cq.sinCorrer + ')');
  chk((cq.fallan || []).some(x => /eje B/.test(x)) &&
      (cq.fallan || []).some(x => /contrargumento/.test(x)),
      'entre las fallas están el eje B sin media histórica y el contrargumento sin revisar (' +
      (cq.fallan || []).join(' · ') + ')');

  const nd = r.nivelDOM || {};
  chk(nd.aviso === false && nd.tarjetasFuera === 0 && nd.diceNivel === false,
      'GUARDA · con los trece casos publicados declarados nacionales, la ficha real no avisa de nada ' +
      '(aviso ' + nd.aviso + ' · ' + nd.tarjetasFuera + ' tarjetas fuera)');

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
  // El cuarto estado. Un caso que una autoridad miró y cerró no se lee igual
  // que uno que nadie ha mirado: se pinta aparte, se cuenta aparte y dice en
  // pantalla que lo cerraron sin mérito. Contarlo como señalamiento sería
  // dejar viva en la ficha una acusación que ya se cayó.
  chk(r.ccPorEstado.arch === esperado.archivados,
      'los casos archivados salen con su propio riel (' + r.ccPorEstado.arch + ' de ' + esperado.archivados + ')');
  chk((r.tagsArch || []).length === esperado.archivados &&
      (r.tagsArch || []).every(t => /sp-tag-ok/.test(t) && /archivado sin hallazgo/.test(t)),
      'y cada uno con la etiqueta verde que dice que una autoridad lo cerró (' + (r.tagsArch || []).length + ')');
  chk(esperado.archivados === 0 || /revis[óo] y lo cerr[óo] sin encontrar m[ée]rito/.test(r.txt),
      'cada archivado explica por qué no pesa');
  chk(od.arch == null || od.sen == null || od.sen < od.arch,
      'y van al final: lo que sigue abierto se lee antes que lo que ya se cerró');
  // Un caso cuya fuente no da el día no puede enseñar un día en pantalla.
  const conTexto = corr.filter(c => c.fechaTexto);
  chk(conTexto.every(c => (r.fechasCC || []).some(f =>
        f.startsWith(c.titulo.slice(0, 30)) && f.endsWith('→ ' + c.fechaTexto))),
      'un caso sin día publicado enseña el texto de su fuente, no un 1 de enero inventado (' + conTexto.length + ')');
  chk(esperado.enInvestigacion === 0 || /Pesa en el veredicto, menos que un confirmado/.test(r.txt),
      'y cada caso en investigación dice que pesa, menos que un confirmado');
  /* La escalera sigue la misma decisión que el veredicto (v972): un peldaño
     marcado cuando hay nivel, NINGUNO cuando no se publica. Exigir siempre uno
     habría obligado a marcar un peldaño que la ficha se niega a publicar, y
     exigir siempre ninguno dejaría pasar una escalera muerta el día que el
     nivel vuelva. */
  const pasosMarcados = r.escalera.filter(x => /\*$/.test(x)).length;
  chk(r.escalera.length === 5 && pasosMarcados === (esperado.veredicto === 'sin-nivel' ||
        esperado.veredicto === 'sin-datos' ? 0 : 1),
      'la escalera marca el peldaño del veredicto, y ninguno cuando no se publica nivel (' +
      esperado.veredicto + ' · ' + pasosMarcados + ' marcados) : ' + r.escalera.join(' · '));
  chk(/peor de los tres techos/.test(r.txt), 'dice en la cara que el veredicto es el peor de tres techos');

  // ── El denominador de la cifra que decide el veredicto ─────────────────
  const cl = r.claridad || {};
  chk(!!cl.hayFila, 'la placa trae la fila del registro verificado');
  chk(!!(cl.hayDen && cl.visible),
      'y su porcentaje NO sale solo: lleva el denominador a la vista' +
      (cl.hayDen ? '' : ' (no hay .sp-fi-techo-den)'));
  chk(/\d+\s+de\s+\d+\s+hechos/.test(cl.den),
      'dice de cuántos hechos sale el porcentaje (' + (cl.den || 'sin denominador') + ')');
  /* Y los que quedan FUERA de la cuenta también se dicen. Es la parte que
     más fácil se calla: un registro con la mitad de sus hechos sin
     clasificar puede enseñar un porcentaje altísimo y no significar nada. */
  chk(/fuera de la cuenta/.test(cl.den) || !/sin declarar/.test(cl.den),
      'y cuando hay hechos sin naturaleza declarada, dice que quedaron fuera de la cuenta');
  // El número de la placa y su denominador tienen que ser el mismo cálculo,
  // no dos cuentas distintas que casualmente coinciden hoy.
  const mPct = cl.texto.match(/(\d+)\s*%/);
  const mDen = cl.den.match(/(\d+)\s+de\s+(\d+)/);
  chk(!!(mPct && mDen && Math.round(100 * (+mDen[1]) / (+mDen[2])) === +mPct[1]),
      'y el porcentaje cuadra con su propio denominador (' + (mPct ? mPct[1] : '?') + ' % · ' + (cl.den || '—') + ')');
  chk(/No mide honestidad/.test(r.txt), 'y qué NO mide');
  chk(r.sinPeldanoViejo, 'ningún peldaño viejo (sostiene / reparos / entredicho) sobrevive en el DOM');
  /* ── La firma de la placa ──────────────────────────────────────────────
     Esta placa se fotografía y la captura circula sola: en un comentario de
     Facebook, en un grupo, recortada. Un veredicto sobre una persona real
     que anda por ahí sin decir quién lo hizo es lo contrario de lo que el
     módulo defiende en todas sus otras frases. */
  const FI = r.firma || {};
  console.log('\n── La firma de la placa ────────────────────────────');
  console.log('  ' + FI.texto + '   ' + FI.fecha);
  chk(FI.hay && /URBIS_CO/i.test(FI.texto || ''),
      'la placa dice quién la analizó (' + (FI.texto || 'sin firma') + ')');
  chk(FI.logoCargo, 'con el logo de URBIS cargado de verdad, no una ruta rota');
  chk(FI.antesDelCargo, 'y va ARRIBA del cargo: es de quien analiza, no del analizado');
  /* Y dónde buscarla. Estas fichas circulan como capturas: sin la dirección,
     quien la ve no tiene cómo llegar al registro ni a las fuentes de cada
     caso, que es donde el módulo se juega la credibilidad. */
  chk(FI.web === 'urbispro.city',
      'y la dirección, para que una captura compartida se pueda seguir (' + (FI.web || 'no está') + ')');
  chk(!/URBIS_COurbispro/.test((FI.webTexto || '').replace(/\s+/g, '')),
      'con el separador puesto por CSS: copiar la firma no pega el nombre con la dirección');
  // La fecha es la del REGISTRO. Sin ella, la captura de hoy se lee dentro
  // de un año como si fuera de hoy, y el veredicto se calcula contando
  // hechos que se acumulan cada día.
  // Se rehace acá el mismo formato corto, para comparar contra el registro y
  // no contra «que haya algo escrito»: lo que se vigila es que la fecha sea
  // la del REGISTRO y no la del día en que alguien abre la aplicación.
  const MESES_C = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const cortaEsperada = (function (iso) {
    const p = String(iso || '').split('-');
    return p.length === 3 ? parseInt(p[2], 10) + ' ' + MESES_C[+p[1] - 1] + ' ' + p[0] : '';
  })(D.actualizado);
  chk(!!cortaEsperada && FI.fecha === cortaEsperada,
      'y lleva la fecha del REGISTRO, no la del día en que se mira (' +
      FI.fecha + ' · registro ' + cortaEsperada + ')');

  chk(r.minPx >= 13, 'ningún texto corrido baja de 13 px en teléfono (mínimo ' + r.minPx + ' px)');
  chk(r.puntos > 6 && r.puntosSinColor === 0,
      'todos los puntos de la leyenda tienen color (' + r.puntosSinColor + ' sin color de ' + r.puntos + ')');
  chk(r.serie.n >= 3 && r.serie.ultimaEnCurso,
      'la serie marca la semana en curso, que siempre va a medias (' + r.serie.n + ' columnas)');
  chk(r.acumulaCreciendo, 'y el acumulado de la serie nunca baja');
  /* ── La ficha del gobierno anterior, con la MISMA regla ─────────────────
     Se mide con `fichaDe`, la misma función pura, y por eso su veredicto es
     comparable en método aunque no en tiempo. Las dos aserciones que
     importan: que el peldaño salga de contar y no esté escrito a mano, y que
     la pantalla lleve el aviso de que cuatro años y un mes no se comparan de
     frente. Sin ese aviso el módulo estaría afirmando algo que sus propias
     cifras no sostienen. */
  console.log('\n── La ficha del gobierno anterior ──────────────────');
  const DA = JSON.parse(fs.readFileSync(REPO + '/assets/data/seguimiento-petro.json', 'utf8'));
  const enMandato = (DA.entradas || []).filter(e => e.fecha >= DA.posesion && e.fecha <= DA.entrega);
  const espAnt = {
    confirmados: ((DA.casos || {}).lista || []).filter(c => c.estado === 'confirmado').length,
    contadas: ((DA.contradicciones || {}).casos || []).filter(c => c.estado === 'documentada' && c.cuenta !== false).length,
    verif: enMandato.filter(e => e.tipoFuente === 'verificado').length,
    conTipo: enMandato.filter(e => e.tipoFuente).length
  };
  espAnt.pct = Math.round(100 * espAnt.verif / espAnt.conTipo);
  espAnt.veredicto = IDS[Math.max(techo.casos(espAnt.confirmados, 0), techo.palabra(espAnt.contadas), techo.claridad(espAnt.pct))];
  const ant = await pg.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.sp-cmp-tab'));
    const i = tabs.findIndex(t => /Petro/.test(t.innerText));
    if (i < 0) return { hay: false, tabs: tabs.length };
    tabs[i].click();
    const c = document.getElementById('sp-ficha');
    return {
      hay: true, tabs: tabs.length,
      nombre: (c.querySelector('.sp-fi-nombre') || {}).textContent || '',
      veredicto: (c.querySelector('.sp-fi-vval') || {}).textContent || '',
      cuentas: (c.querySelector('.sp-fi-cuentas') || {}).textContent || '',
      aviso: (c.querySelector('.sp-fi-aviso-tiempo') || {}).innerText || '',
      confirmados: c.querySelectorAll('.sp-fi-cc-conf').length,
      desmentidas: Array.from(c.querySelectorAll('.sp-fi-caso')).filter(x => /desmentid/i.test(x.innerText)).length,
      serie: c.querySelectorAll('.sp-fi-col').length,
      txt: c.innerText
    };
  });
  console.log('  ' + ant.nombre + ' → ' + ant.veredicto + ' · ' + ant.cuentas);
  chk(ant.tabs === 3, 'la ficha tiene tres pestañas: el actual, el anterior y la comparación (' + ant.tabs + ')');
  chk(ant.hay && /Gustavo Petro/.test(ant.nombre), 'la segunda abre la ficha del gobierno anterior');
  chk(ant.veredicto === ESCALERA_T[espAnt.veredicto],
      'su peldaño sale de contar con la misma regla, no escrito a mano (' + ant.veredicto + ' · recuento ' + espAnt.veredicto + ')');
  chk(new RegExp(espAnt.confirmados + ' casos? confirmados?').test(ant.cuentas) && new RegExp(espAnt.pct + ' % verificado').test(ant.cuentas),
      'y sus cuentas coinciden con el registro (' + ant.cuentas + ')');
  chk(ant.confirmados === espAnt.confirmados && espAnt.confirmados > 0,
      'los casos confirmados del gobierno anterior se pintan como tales (' + ant.confirmados + ')');
  chk(ant.desmentidas >= 2, 'las acusaciones desmentidas contra él están y se marcan como no contadas (' + ant.desmentidas + ')');
  chk(/no se compara de frente/i.test(ant.aviso) && /cuatro años/i.test(ant.aviso),
      'y la pantalla avisa que cuatro años y unas semanas no se comparan de frente');
  chk(/no es exhaustivo/i.test(ant.aviso), 'y dice que el registro del anterior no es exhaustivo');
  chk(ant.serie === 0, 'no se dibuja la serie semanal de un mandato cerrado (' + ant.serie + ' columnas)');

  /* ── La pestaña de al lado: cómo fue Petro y cómo va De la Espriella ────
     Es una tabla de cifras, NO una segunda ficha con veredicto: la escalera
     está pensada para un mandato en curso y aplicarla a uno cerrado
     compararía cuatro años contra unas semanas.

     La aserción que de verdad importa es la última: el bloque de
     desinformación tiene que mostrar las DOS direcciones —lo que le
     inventaron y lo que él difundió—. Sin eso, la pestaña deja de ser un
     registro y pasa a ser una defensa, y entonces tampoco se le puede creer
     a la ficha del gobernante actual: sería la misma pantalla midiendo a uno
     con cuentas y al otro con adjetivos. */
  console.log('\n── Cómo fue y cómo va ──────────────────────────────');
  const cmpD = (D.comparacion || {});
  const esperadasFilas = (cmpD.filas || []).length;
  const cmp = await pg.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.sp-cmp-tab'));
    const i = tabs.findIndex(t => /Cómo fue/.test(t.innerText));
    if (i < 0) return { tabs: tabs.length };
    tabs[i].click();
    const caja = document.getElementById('sp-ficha');
    const filas = Array.from(caja.querySelectorAll('.sp-cmp-fila'));
    return {
      tabs: tabs.length,
      rotulos: tabs.map(t => t.innerText.replace(/\n/g, ' · ')),
      activa: (caja.querySelector('.sp-cmp-tab.on') || {}).innerText || '',
      filas: filas.length,
      sinFuente: filas.filter(f => !f.querySelector('.sp-fuentes a[href^="https"]')).length,
      avisos: caja.querySelectorAll('.sp-cmp-aviso').length,
      comparables: caja.querySelectorAll('.sp-cmp-fila.sp-cmp-comparable').length,
      contra: caja.querySelectorAll('.sp-cmp-contra .sp-cmp-bulo').length,
      haySuya: !!caja.querySelector('.sp-cmp-suya'),
      // Ninguna ficha ni peldaño para el anterior: acá no se juzga, se cuenta.
      sinVeredicto: !caja.querySelector('.sp-fi-placa') && !caja.querySelector('.sp-fi-paso'),
      txt: caja.innerText
    };
  });
  console.log('  ' + (cmp.rotulos || []).join('  |  '));
  console.log('  ' + cmp.filas + ' filas · ' + cmp.comparables + ' comparables · ' + cmp.avisos + ' con aviso');
  chk(cmp.tabs === 3, 'la comparación sigue accesible desde su pestaña (' + cmp.tabs + ' pestañas)');
  chk(/Gustavo Petro/.test((cmp.rotulos || []).join(' ')), 'la segunda nombra al gobierno anterior');
  chk(cmp.filas === esperadasFilas && esperadasFilas >= 6,
      'la tabla trae todas las filas del registro (' + cmp.filas + ' de ' + esperadasFilas + ')');
  chk(cmp.sinFuente === 0, 'y cada fila lleva su fuente con enlace (' + cmp.sinFuente + ' sin ella)');
  chk(cmp.avisos === esperadasFilas - cmp.comparables && cmp.avisos > 0,
      'las filas que todavía no se pueden comparar lo dicen en pantalla (' + cmp.avisos + ')');
  chk(/dólar|TRM/i.test(cmp.txt) && /4\.337/.test(cmp.txt) && /3\.099/.test(cmp.txt),
      'el dólar va con las dos cifras: cómo lo recibió y cómo está hoy');
  chk(/64 %|deuda/i.test(cmp.txt) && /1,7 %/.test(cmp.txt),
      'y también lo que no favorece al gobierno anterior: deuda y caída del crecimiento');
  chk(cmp.sinVeredicto, 'la comparación NO le pone veredicto ni peldaño al gobierno anterior');
  chk(cmp.contra >= 2 && cmp.haySuya,
      'la desinformación se muestra en las DOS direcciones: lo que le inventaron y lo que difundió (' + cmp.contra + ' bulos + su propio registro)');
  chk(/159|126/.test(cmp.txt), 'con la cuenta de los verificadores sobre él, no solo la de sus atacantes');

  /* ══ LA PUERTA DE PUBLICACIÓN Y EL TABLERO (v971) ══════════════════════
     El registro guarda más de lo que la pantalla publica, y lo que puede
     costar una demanda es que esa diferencia se invierta: un señalamiento
     saliendo como hallazgo, o un acto municipal contado dentro del score de
     un presidente. */

  /* Las cinco ramas se miden contra un registro FABRICADO y no contra el
     real: contra el real se mediría el número —hoy hay 56 no verificadas y
     cero de otro nivel— y el día que el registro mejore la comprobación se
     quedaría sin material sin decirlo. Es la lección de la v970. */
  const puerta = await pg.evaluate(() => {
    const a = window.URBIS_SEG_FICHA;
    const h = (f, n, extra) => Object.assign({ fecha: f, titulo: n, categoria: 'gobierno',
      tipoFuente: 'verificado', categoriaProbatoria: 'hecho-probado', tipoMedicion: 'actividad',
      nivelGobierno: 'nacional' }, extra || {});
    const reg = { posesion: '2026-08-07', actualizado: '2026-09-19', entradas: [
      h('2026-09-01', 'nacional verificado'),
      h('2026-09-02', 'municipal', { nivelGobierno: 'municipal' }),
      h('2026-09-03', 'en circulación', { categoriaProbatoria: 'en-circulacion' }),
      h('2026-09-04', 'no verificado', { tipoFuente: 'disputado' }),
      h('2026-09-05', 'con defecto nuestro', { noPublicar: { motivo: 'La cifra no se sostuvo.' } }),
      h('', 'sin fecha')
    ] };
    return { motivos: reg.entradas.map(e => a.sePublica(e).motivo),
             textos: reg.entradas.map(e => a.sePublica(e).texto),
             censo: a.censoPublicacion(reg),
             publicables: a.publicables(reg).length,
             // El nivel se filtra en la ÚNICA puerta por la que los hechos
             // entran al score: acá entran los tres nacionales publicables
             // más… ninguno más. El municipal, el sin fecha y el de defecto
             // propio se quedan fuera de la CUENTA, no solo de la pantalla.
             hechosScore: a.indicadores(reg).hechos };
  });
  console.log('  puerta: ' + puerta.censo.publica + ' publica de ' + puerta.censo.n +
              ' · al score ' + puerta.hechosScore + ' · motivos ' +
              puerta.motivos.map(m => m || 'publica').join(', '));
  const ramas = ['otro-nivel', 'en-circulacion', 'no-verificado', 'defecto-propio', 'sin-fecha'];
  chk(puerta.motivos[0] === null && ramas.every(r => puerta.motivos.indexOf(r) > 0),
      'MATERIAL · el registro fabricado ejercita las cinco ramas de la puerta (' +
      puerta.motivos.map(m => m || 'publica').join(' · ') + ')');
  chk(puerta.censo.publica === 1 && puerta.censo.fuera === 5 &&
      Object.keys(puerta.censo.por).every(k => puerta.censo.por[k] === 1),
      'la puerta publica solo el hecho verificado, fechado y nacional (' +
      puerta.censo.publica + ' de ' + puerta.censo.n + ')');
  chk(puerta.textos.slice(1).every(t => t && t.length > 20) &&
      /defecto/i.test(puerta.textos[4]) && /La cifra no se sostuvo/.test(puerta.textos[4]),
      'y cada rechazo devuelve SU motivo en palabras, no un false (v876)');
  chk(puerta.hechosScore === 3,
      'el nivel de gobierno se filtra en la puerta del score: un acto municipal no entra (' +
      puerta.hechosScore + ' hechos)');
  chk(puerta.publicables === 1, 'y la lista publicable sale de la misma puerta, no de un segundo filtro');

  await pg.goto(base + '/seguimiento.html#/tablero', { waitUntil: 'load' });
  await pg.waitForTimeout(1600);
  const tab = await pg.evaluate(() => {
    const t = document.getElementById('sp-tablero');
    const ed = t && t.querySelector('.sp-edit');
    const svgs = t ? Array.from(t.querySelectorAll('svg.sp-g')) : [];
    return {
      hijos: t ? t.children.length : 0,
      // Los SIETE gráficos del pliego, cada uno dibujado o declarado sin
      // dato: es la cuenta que dice que ninguna pieza se cayó en silencio.
      // Un `children.length` sería un proxy —hoy son cinco bloques y siete
      // tarjetas dentro de uno solo— y mediría otra cosa de la que dice.
      tarjetas: t ? t.querySelectorAll('.sp-graficas .sp-graf').length : 0,
      heroeSvg: t ? t.querySelectorAll('.sp-heroe svg.sp-g').length : 0,
      svgs: svgs.length,
      // Cada gráfico lleva su fuente y su fecha de corte DENTRO del SVG.
      conPie: svgs.filter(s => {
        const p = Array.from(s.querySelectorAll('.sp-g-pie-t')).map(x => x.textContent).join(' ');
        return /Fuente:/.test(p) && /Fecha de corte:/.test(p);
      }).length,
      // Ningún glifo con trazo encima: el reset de iconos se hereda y pintaba
      // un contorno de 1,9 sobre cada letra y cada tajada.
      conTrazo: svgs.reduce((n, s) => n + Array.from(s.querySelectorAll('text'))
        .filter(x => { const k = getComputedStyle(x).stroke; return k && k !== 'none'; }).length, 0),
      heroe: (t.querySelector('.sp-heroe-n') || {}).textContent || '',
      falta: t ? t.querySelectorAll('.sp-graf-falta').length : 0,
      titulos: t ? Array.from(t.querySelectorAll('.sp-graf-h')).map(x => x.textContent) : [],
      /* El editorial va DESPUÉS de los gráficos, no entre ellos: una opinión
         en medio del bloque se lee como el pie de la tarjeta de arriba. */
      editDespues: !!(ed && t.querySelector('.sp-graficas') &&
        ed.getBoundingClientRect().top > t.querySelector('.sp-graficas').getBoundingClientRect().top),
      edit: !!ed,
      editSerif: ed ? /serif|Georgia/i.test(getComputedStyle(ed).fontFamily) : false,
      rect: !!t.querySelector('.sp-rect'),
      pend: !!t.querySelector('.sp-pend')
    };
  });
  console.log('  tablero: ' + tab.svgs + ' gráficos · ' + tab.falta + ' declarados sin dato · héroe ' + tab.heroe);
  /* EL BLOQUE ES TODO LO QUE EL REGISTRO PUEDE GRAFICAR, no los siete del
     pliego: la v972 le sumó lo fiscal y las series. El número exacto no se
     fija acá —sería una constante del registro metida en la comprobación, que
     es la lección de la v890—: se exige que estén los SIETE del pliego por su
     nombre, y que el resto del registro también salga. */
  var DEL_PLIEGO = ['Composición del Presupuesto', 'Variación real por sector',
                    'dos agregaciones', 'Qué entra al score presidencial',
                    'Huila', 'decisión nacional al uso municipal', 'técnicas de distorsión'];
  var faltanDelPliego = DEL_PLIEGO.filter(function (t) {
    return !(tab.titulos || []).some(function (x) { return x.indexOf(t) >= 0; });
  });
  chk(faltanDelPliego.length === 0 && tab.heroeSvg === 1,
      'los SIETE gráficos del pliego salen, cada uno dibujado o declarado, y el héroe encima: ' +
      'una pieza que reviente en silencio deja de aparecer (' +
      (faltanDelPliego.length ? 'faltan: ' + faltanDelPliego.join(' · ') : 'los siete') +
      ' · héroe ' + tab.heroeSvg + ')');
  chk(tab.tarjetas >= 14 && tab.svgs >= 8,
      'y con ellos TODO lo demás que el registro trae con fuente y fecha (' +
      tab.tarjetas + ' tarjetas · ' + tab.svgs + ' svg.sp-g)');
  /* Las tres cifras fiscales que la v972 entró, leídas del PAPEL: si el bloque
     `fiscal` desapareciera del registro, las tarjetas se caerían en silencio. */
  chk(['Con cuánta deuda nueva', 'Déficit primario de 2026',
       'Intereses de la deuda contra inversión'].every(function (t) {
         return (tab.titulos || []).some(function (x) { return x.indexOf(t) >= 0; }); }),
      'las tres comparaciones fiscales salen del bloque `fiscal` y del héroe, no de números tecleados');
  /* `cocaina` está en el registro con su título, su unidad, sus puntos y su
     fuente desde hace tandas, y NINGUNA pantalla la dibujaba: la lista de
     series estaba escrita a mano y no la nombraba. Es la clase C —un dato que
     existe y no alcanza a ningún lector— y por eso la aserción es por su
     nombre y no por el conteo, que no la distinguiría. */
  chk((tab.titulos || []).some(function (x) { return /Cocaína incautada/.test(x); }),
      'y la serie que ninguna pantalla dibujaba —cocaína incautada— ya sale');
  chk(tab.editDespues,
      'el editorial va DESPUÉS del bloque y no entre dos gráficos');
  chk(tab.conPie === tab.svgs && tab.svgs > 0,
      'cada gráfico lleva su fuente y su fecha de corte DENTRO del gráfico (' +
      tab.conPie + ' de ' + tab.svgs + ')');
  chk(tab.conTrazo === 0,
      'y ningún rótulo se dibuja con un trazo encima del glifo (' + tab.conTrazo + ' con trazo)');
  chk(tab.falta >= 1,
      'lo que no se puede dibujar con el registro se declara, no se inventa (' +
      tab.falta + ' gráficos con su vacío escrito)');
  chk(tab.edit && tab.editSerif,
      'la opinión firmada va en serif, que la separa de los datos sin etiqueta');
  chk(tab.rect, 'y el canal de rectificación está en la pantalla, no solo en el registro');

  /* El recuento de lo que NO se publica sale en pantalla, en GRIS y con su
     cifra, y SIN los títulos: nombrarlos sería publicarlos, que es justo lo
     que la puerta viene a impedir. Se mide acá y no en la ficha porque el
     bloque vive en el tablero; medirlo allá lo habría dado por ausente y la
     aserción habría fallado por el sitio y no por el código. */
  const censoDom = await pg.evaluate(() => {
    const a = window.URBIS_SEG_FICHA, c = a.censoPublicacion();
    const caja = document.querySelector('#sp-tablero .sp-pend');
    const txt = caja ? caja.innerText : '';
    const ROJOS = /rgb\(201, 90, 85\)|rgb\(184, 17, 46\)|rgb\(138, 18, 32\)/;
    // Ninguno de los títulos retenidos puede aparecer en el bloque.
    const fuera = a.retenidas().map(e => e.titulo).filter(Boolean);
    return { hay: !!caja, censo: c,
             diceCuantas: new RegExp(String(c.fuera)).test(txt),
             rojo: caja ? Array.from(caja.querySelectorAll('*')).some(x =>
                     ROJOS.test(getComputedStyle(x).color)) : true,
             titulos: fuera.filter(t => t.length > 25 && txt.indexOf(t) >= 0).length,
             nFuera: fuera.length };
  });
  chk(censoDom.hay && censoDom.diceCuantas,
      'el recuento de lo que NO se publica sale en pantalla con su cifra (' +
      censoDom.censo.fuera + ' de ' + censoDom.censo.n + ')');
  chk(censoDom.hay && !censoDom.rojo,
      'y va en gris: nuestra deuda interna no se pinta con el rojo de un hallazgo del gobierno');
  chk(censoDom.hay && censoDom.titulos === 0,
      'y sin los títulos de lo retenido: nombrarlos en pantalla sería publicarlos (' +
      censoDom.titulos + ' de ' + censoDom.nFuera + ' asomados)');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close(); server.close();

  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
