const E = require('../entorno.js');
/* EL PANEL DE APROBAR CABE EN LA PANTALLA (v831)
   ────────────────────────────────────────────────────────────────────────
   Se dijo así: «si yo ingreso como admin supremo y quiero aprobar unos
   reportes, cuando voy a aprobar y quiero ver dónde se ubica en el mapa,
   hay un conflicto en cómo verlo, porque a veces el reporte es tan largo
   que ocupa más de la pantalla completa… toca acomodarse mucho».

   El panel viejo daba un renglón con el título y un botón «Ver» que CERRABA
   el panel para abrir el detalle. Y el detalle de un reporte con una nota
   larga es más alto que un teléfono. Así que moderar era: abrir el panel,
   salir del panel, leer, volver a abrir el panel, aprobar. Por reporte.

   Lo que decide una aprobación son tres cosas —la foto (que desde la v829
   es justo lo que se autoriza a publicar), la nota, y DÓNDE QUEDA— y las
   tres caben en la ficha. La nota, recortada a tres renglones y desplegable
   ahí mismo; el mapa, dentro de la ficha.

   La regla de la que cuelga todo el diseño, y la que esta suite defiende
   con números y no con intenciones:

       UNA FICHA NO PUEDE SER MÁS ALTA QUE LA PANTALLA.

   Se mide con un reporte de nota monstruosa en una pantalla de teléfono. Si
   algún día alguien quita el recorte de la nota «porque se lee mejor
   entera», esta prueba se pone roja, que es exactamente para lo que está.

   Y se mide que un mapa plegado se DESTRUYE: veinte Leaflet vivos detrás de
   una lista dejan el teléfono inservible, y el defecto no se ve mirando la
   pantalla — solo se ve contándolos.                                     */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  // Un teléfono de los apretados: si cabe acá, cabe en todos.
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  const LEAFLET = (E.TRABAJO || '') + 'node_modules/leaflet/dist/';
  await pg.route('**/leaflet*.js', r => r.fulfill({ contentType: 'application/javascript',
    body: fs.readFileSync(LEAFLET + 'leaflet.js', 'utf8') }));
  await pg.route('**/leaflet*.css', r => r.fulfill({ contentType: 'text/css',
    body: fs.readFileSync(LEAFLET + 'leaflet.css', 'utf8') }));
  // Las teselas no se piden a la red: la caja no tiene salida y una prueba
  // que dependa de que carguen sería una prueba que falla por el clima.
  await pg.route('**/basemaps.cartocdn.com/**', r => r.fulfill({ status: 200, contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
  await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const BASE = 43;
  // Una nota monstruosa: el caso que se reclamó.
  const NOTA_LARGA = Array.from({ length: 40 },
    (_, i) => 'Renglón ' + (i + 1) + ' de una nota larguísima que el ciudadano escribió con todo el detalle del hecho.').join(' ');

  await pg.evaluate(([base, notaLarga]) => {
    const fila = (o) => {
      const d = new Array(base + 9).fill('');
      d[0] = o.cat || 'Hueco en la vía';
      d[1] = o.titulo;
      d[2] = o.nota || '';
      d[3] = 'Malo';
      d[base] = o.foto ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' : '';
      d[base + 1] = 'Pendiente';
      d[base + 2] = o.autor || 'marta.rios';
      d[base + 3] = 'citizen';
      d[base + 4] = '0';
      d[base + 7] = o.barrio || 'La Floresta';
      return d.join(' | ');
    };
    const puntos = [
      { lat: 6.2501, lng: -75.5601, tipo: '🚨 Alertas y Riesgos Urbanos', descripcion: fila({ titulo: 'Hueco enorme frente al colegio', nota: notaLarga, foto: true }) },
      { lat: 6.2502, lng: -75.5602, tipo: '🚗 Reportes de Tráfico', descripcion: fila({ titulo: 'Semáforo apagado', nota: 'Lleva dos días sin funcionar.', foto: false, autor: 'beto.p' }) },
      { lat: 6.2503, lng: -75.5603, tipo: '🚨 Alertas y Riesgos Urbanos', descripcion: fila({ titulo: 'Poste inclinado', nota: '', foto: true, autor: 'caro.m' }) }
    ];
    // Sesión de administrador y datos, sin pasar por el login ni por la red.
    window.__authReal = window.URBIS_AUTH;
    window.URBIS_AUTH = Object.assign({}, window.__authReal, {
      readSession: () => ({ usuario: 'moderadora', rol: 'admin', es_admin: true, session_token: 't' })
    });
    window.userRole = 'admin';
    document.body.dataset.role = 'admin';
    try { globalData.length = 0; puntos.forEach(p => globalData.push(p)); } catch (e) { window.globalData = puntos; }
  }, [BASE, NOTA_LARGA]);

  chk(await pg.evaluate(() => typeof window.urbisAbrirPanelAdmin === 'function'),
      'el panel de moderación existe');
  chk(await pg.evaluate(() => window.urbisReportesPorAprobar().length) === 3,
      'y ve los tres reportes pendientes que se le pusieron');

  // Abrir el panel y entrar a la bandeja «Por aprobar».
  await pg.evaluate(() => { window.urbisAbrirPanelAdmin(); });
  await pg.click('#urbis-admin-overlay [data-uadm="aprobar"]');
  await pg.waitForTimeout(200);

  // ── 1. La ficha cabe en la pantalla ────────────────────────────────────
  const medidas = await pg.evaluate(() => {
    const fichas = [...document.querySelectorAll('#urbis-admin-overlay .uadm-apr')];
    return {
      n: fichas.length,
      altos: fichas.map(f => Math.round(f.getBoundingClientRect().height)),
      pantalla: window.innerHeight,
      anchoDesborde: fichas.some(f => f.scrollWidth > f.clientWidth + 1)
    };
  });
  chk(medidas.n === 3, 'la bandeja pinta las tres fichas (' + medidas.n + ')');
  /* Estas tres exigen que HAYA tres fichas medidas. Sin eso, «ninguna se
     pasa de alto» es cierta sobre una lista vacía: la comprobación más
     importante de la suite pasaría sin haber medido nada, que es la peor
     manera de tener una prueba en verde. */
  chk(medidas.altos.length === 3 && medidas.altos.every(h => h < medidas.pantalla),
      'ninguna ficha es más alta que la pantalla, ni la del reporte de nota monstruosa (' +
      (medidas.altos.join(', ') || 'no se midió ninguna') + ' contra ' + medidas.pantalla + ')');
  chk(medidas.altos.length === 3 && !medidas.anchoDesborde, 'y ninguna se sale de ancho');

  // ── 2. Lo que decide la aprobación está en la ficha ────────────────────
  const contenido = await pg.evaluate(() => {
    /* Contra la versión anterior no hay fichas de estas: se devuelve un
       vacío para que la suite diga QUÉ falta, en vez de reventar con una
       excepción que no enseña nada. */
    const f = document.querySelector('#urbis-admin-overlay .uadm-apr');
    if (!f) return { hayFoto:false, hayNota:false, notaRecortada:false, hayVerMas:false, barrio:'', avisoCedula:false, acciones:[] };
    const nota = f.querySelector('[data-nota]');
    return {
      hayFoto: !!f.querySelector('img.uadm-apr-foto'),
      hayNota: !!nota,
      notaRecortada: nota ? nota.scrollHeight > nota.clientHeight + 2 : false,
      hayVerMas: !!(f.querySelector('.uadm-apr-mas') && !f.querySelector('.uadm-apr-mas').hidden),
      barrio: (f.querySelector('.uadm-apr-donde') || {}).textContent || '',
      avisoCedula: /cédula/i.test(f.textContent),
      acciones: [...f.querySelectorAll('[data-acc]')].map(x => x.getAttribute('data-acc'))
    };
  });
  chk(contenido.hayFoto, 'la ficha enseña la foto que se va a publicar, sin tener que abrir nada');
  chk(contenido.notaRecortada && contenido.hayVerMas,
      'la nota larga sale recortada y con «ver la nota completa»');
  chk(/La Floresta/.test(contenido.barrio), 'dice el barrio (' + contenido.barrio.trim() + ')');
  chk(contenido.avisoCedula,
      'y recuerda que aprobar la foto es avalar que la cédula del autor se comprobó');
  ['aprobar', 'mapa', 'ver'].forEach(a =>
    chk(contenido.acciones.includes(a), 'la ficha ofrece la acción «' + a + '» sin salir del panel'));

  // El «ver más» NO puede salir en la ficha de nota corta: un aviso que sale
  // siempre enseña a ignorarlo, y entonces deja de avisar cuando hace falta.
  const cortita = await pg.evaluate(() => {
    const f = [...document.querySelectorAll('#urbis-admin-overlay .uadm-apr')][1];
    if (!f) return { hay:false, visible:false };
    const mas = f.querySelector('.uadm-apr-mas');
    return { hay: !!mas, visible: !!(mas && !mas.hidden) };
  });
  chk(!cortita.visible, 'y en un reporte de nota corta ese botón no aparece');

  // ── 3. Desplegar la nota no rompe el trato ─────────────────────────────
  await pg.evaluate(() => {
    const b = document.querySelector('#urbis-admin-overlay .uadm-apr .uadm-apr-mas');
    if (b) b.click();
  });
  await pg.waitForTimeout(120);
  const desplegada = await pg.evaluate(() => {
    const f = document.querySelector('#urbis-admin-overlay .uadm-apr');
    if (!f) return { abierta:false, altoFicha:0, pantalla:window.innerHeight, notaScrollea:false, etiqueta:'' };
    const n = f.querySelector('[data-nota]');
    return {
      abierta: n.classList.contains('abierta'),
      altoFicha: Math.round(f.getBoundingClientRect().height),
      pantalla: window.innerHeight,
      notaScrollea: n.scrollHeight > n.clientHeight + 2,
      etiqueta: f.querySelector('.uadm-apr-mas').textContent
    };
  });
  chk(desplegada.abierta && /Recortar/.test(desplegada.etiqueta),
      'al pedirla, la nota se despliega y el botón dice cómo volver a recortarla');
  chk(desplegada.altoFicha < desplegada.pantalla,
      'y AUN DESPLEGADA la ficha sigue cabiendo: la nota scrollea dentro de sí misma (' +
      desplegada.altoFicha + ' contra ' + desplegada.pantalla + ')');
  chk(desplegada.notaScrollea, 'la nota larga tiene su propio scroll, no estira la ficha');

  // ── 4. El mapa se abre DENTRO de la ficha ──────────────────────────────
  await pg.evaluate(() => {
    const b = document.querySelector('#urbis-admin-overlay .uadm-apr [data-acc="mapa"]');
    if (b) b.click();
  });
  await pg.waitForTimeout(400);
  const conMapa = await pg.evaluate(() => {
    const f = document.querySelector('#urbis-admin-overlay .uadm-apr');
    if (!f) return { panelSigueAbierto: !!document.getElementById('urbis-admin-overlay'),
                     visible:false, dentroDeLaFicha:false, hayLeaflet:false, alto:0,
                     altoFicha:0, pantalla:window.innerHeight, etiqueta:'(no hay ficha)' };
    const caja = f.querySelector('.uadm-apr-mapa');
    if (!caja) return { panelSigueAbierto:true, visible:false, dentroDeLaFicha:false, hayLeaflet:false,
                        alto:0, altoFicha:Math.round(f.getBoundingClientRect().height),
                        pantalla:window.innerHeight, etiqueta:'(no hay caja de mapa)' };
    return {
      panelSigueAbierto: !!document.getElementById('urbis-admin-overlay'),
      visible: !caja.hidden,
      dentroDeLaFicha: f.contains(caja),
      hayLeaflet: !!caja.querySelector('.leaflet-container'),
      alto: Math.round(caja.getBoundingClientRect().height),
      altoFicha: Math.round(f.getBoundingClientRect().height),
      pantalla: window.innerHeight,
      etiqueta: f.querySelector('[data-acc="mapa"]').textContent
    };
  });
  // Se exige además que el botón EXISTA y haya cambiado de etiqueta: sin
  // eso, «el panel sigue abierto» sería cierto por no haber tocado nada.
  chk(conMapa.panelSigueAbierto && conMapa.visible,
      'ver dónde queda YA NO cierra el panel: eso era lo incómodo, salir y volver a entrar por cada reporte');
  chk(conMapa.visible && conMapa.dentroDeLaFicha && conMapa.hayLeaflet,
      'el mapa se dibuja dentro de la misma ficha');
  chk(conMapa.alto > 80, 'y con tamaño suficiente para reconocer la cuadra (' + conMapa.alto + 'px)');
  chk(conMapa.altoFicha > 0 && conMapa.altoFicha < conMapa.pantalla,
      'con el mapa abierto la ficha TAMPOCO se pasa de la pantalla (' + conMapa.altoFicha + ' contra ' + conMapa.pantalla + ')');
  /* Medido al escribir esto: con la nota desplegada Y el mapa abierto, la
     ficha llegaba a 775 píxeles en una pantalla de 640 — el mismo defecto
     que esta pantalla venía a arreglar. Por eso en una ficha se despliega
     una cosa a la vez, y por eso se comprueba. */
  const notaTrasMapa = await pg.evaluate(() => {
    const f = document.querySelector('#urbis-admin-overlay .uadm-apr');
    if (!f) return { notaAbierta:false, etiquetaNota:'' };
    return {
      notaAbierta: !!f.querySelector('[data-nota].abierta'),
      etiquetaNota: (f.querySelector('.uadm-apr-mas') || {}).textContent || ''
    };
  });
  chk(!notaTrasMapa.notaAbierta && /Ver la nota completa/.test(notaTrasMapa.etiquetaNota),
      'abrir el mapa recoge la nota desplegada: en una ficha se despliega una cosa a la vez, o vuelve a no caber');
  chk(/Ocultar/.test(conMapa.etiqueta), 'y el botón dice cómo cerrarlo');

  // ── 5. Un solo mapa vivo, y plegarlo lo destruye ───────────────────────
  // `nth-of-type` contaría también el renglón de la cuenta, que es otro
  // <div> hermano: se toma la segunda ficha por su lista, no por su posición.
  await pg.evaluate(() => {
    const f = document.querySelectorAll('#urbis-admin-overlay .uadm-apr')[1];
    const b = f && f.querySelector('[data-acc="mapa"]');
    if (b) b.click();
  });
  await pg.waitForTimeout(400);
  const dos = await pg.evaluate(() => ({
    contenedores: document.querySelectorAll('#urbis-admin-overlay .leaflet-container').length,
    abiertos: [...document.querySelectorAll('#urbis-admin-overlay .uadm-apr-mapa')].filter(c => !c.hidden).length
  }));
  chk(dos.abiertos === 1 && dos.contenedores === 1,
      'abrir el mapa de otra ficha cierra el anterior: uno a la vez (' + dos.contenedores + ' vivo)');

  const cerrado = await pg.evaluate(async () => {
    const f = document.querySelectorAll('#urbis-admin-overlay .uadm-apr')[1];
    const b = f && f.querySelector('[data-acc="mapa"]');
    if (!b) return { contenedores:-1, vaciada:false, etiqueta:'(no hay botón de mapa)' };
    b.click();
    await new Promise(r => setTimeout(r, 200));
    return {
      contenedores: document.querySelectorAll('#urbis-admin-overlay .leaflet-container').length,
      vaciada: [...document.querySelectorAll('#urbis-admin-overlay .uadm-apr-mapa')].every(c => c.innerHTML === ''),
      etiqueta: b.textContent
    };
  });
  chk(cerrado.contenedores === 0 && cerrado.vaciada,
      'y plegarlo lo DESTRUYE: un Leaflet escondido sigue vivo con sus oyentes, y en una bandeja de veinte serían veinte');
  chk(/Dónde queda/.test(cerrado.etiqueta), 'el botón vuelve a decir lo que hace');

  // ── 6. Aprobar sigue aprobando ─────────────────────────────────────────
  const aprobado = await pg.evaluate(async () => {
    const original = window.urbisDBUpdate;
    let capturado = null;
    window.urbisDBUpdate = (k, v, campos) => { capturado = { k, v, campos }; return Promise.resolve({ ok: true }); };
    // Contra la versión anterior la ficha se llama solo `uadm-item`: se
    // cuenta lo que haya, para que el resto de la suite siga midiendo.
    const sel = document.querySelectorAll('#urbis-admin-overlay .uadm-apr').length
      ? '#urbis-admin-overlay .uadm-apr' : '#urbis-admin-overlay .uadm-item';
    const antesFichas = document.querySelectorAll(sel).length;
    const bAp = document.querySelector(sel + ' [data-acc="aprobar"]');
    if (!bAp) { window.urbisDBUpdate = original; return { capturado:null, antesFichas, despues:antesFichas }; }
    bAp.click();
    await new Promise(r => setTimeout(r, 300));
    const despues = document.querySelectorAll(sel).length;
    window.urbisDBUpdate = original;
    return { capturado, antesFichas, despues };
  });
  chk(!!aprobado.capturado && aprobado.capturado.k === 'lat',
      'aprobar desde la ficha manda la fila al servidor');
  if (aprobado.capturado) {
    const partes = String(aprobado.capturado.campos.descripcion || '').split(' | ');
    chk(partes[BASE + 1] === 'Aprobado', 'con la casilla de aprobación en «Aprobado»');
    chk(partes[2].indexOf('Renglón 40') !== -1,
        'y sin tocar la nota que escribió el ciudadano, entera');
  }
  chk(aprobado.despues === aprobado.antesFichas - 1,
      'la ficha aprobada sale de la bandeja (' + aprobado.antesFichas + ' → ' + aprobado.despues + ')');

  // ── 7. Sin coordenadas no se inventa un mapa ───────────────────────────
  const sinCoord = await pg.evaluate(async () => {
    const f = document.querySelector('#urbis-admin-overlay .uadm-apr');
    if (!f || !f.querySelector('[data-acc="mapa"]')) return '(no hay mapa en la ficha)';
    f.setAttribute('data-lng', '');
    f.querySelector('[data-acc="mapa"]').click();
    await new Promise(r => setTimeout(r, 200));
    return f.querySelector('.uadm-apr-mapa').textContent;
  });
  chk(/No se pudo dibujar el mapa/.test(sinCoord),
      'un reporte sin coordenadas lo dice, en vez de enseñar un cuadro gris que parece un mapa roto');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
