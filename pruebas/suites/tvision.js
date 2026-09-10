const E = require('../entorno.js');
/* VISIÓN TERRITORIAL · primera entrega (v844)
   ────────────────────────────────────────────────────────────────────────
   El sexto módulo: una capa de decisión urbanística para alcaldes,
   gobernadores y presidentes. URBIS detecta déficits de equipamientos, los
   prioriza y propone ubicaciones; la persona decide. Página PROPIA
   (vision-territorial.html), como el módulo de empresas, porque el
   antecedente que no se puede repetir es un módulo que comparte estado con
   otro y termina mezclando contenido.

   Lo que esta suite vigila, en el orden del encargo:

     · AISLAMIENTO. La página no carga ni un módulo de index.html, no hace
       ni una petición al Apps Script de los reportes, y desde
       ?app=educativo ninguna pantalla suya existe. Un reporte ciudadano no
       aparece como propuesta; una propuesta no aparece en los reportes.
     · CUATRO ESTADOS por pantalla: cargando, con datos, sin datos, error.
       Y el vacío enseña, no se disculpa.
     · La primera pantalla SIEMPRE muestra un dato de la ciudad.
     · El mapa: iconos de línea de tamaño FIJO (no crecen con el zoom),
       sin emojis, manchas difusas sin borde, y SOLO las propuestas pulsan.
     · Las dos prioridades juntas; descartar exige motivo; si un rol no
       puede algo, el botón no existe.
     · Cada pantalla vuelve a su padre. Una sola capa modal a la vez.

   Se corre contra el motor local con la base de pruebas (VT_DATABASE_URL
   en el script de reinicio) y una licencia firmada con el secreto de
   pruebas. Nada de esto toca producción.                                  */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const path = require('path');

const SECRETO = 'secreto-de-pruebas-locales-no-es-el-de-produccion';
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  let emitir = null;
  try { ({ emitir } = require(path.join(E.MOTOR_REPO, 'licencias.js'))); } catch (e) {}
  chk(!!emitir, 'el motor tiene el emisor de licencias (para firmar una con territorio y rol)');
  const lic = (rol, dane) => emitir ? emitir({ cliente: 'Prueba ' + rol, vence: '2099-01-01', cupo: 0, vt: { dane: dane || '54001', rol } }, SECRETO).licencia : '';
  const GOB = lic('gobernante'), VEE = lic('veedor'), ZULIA = lic('tecnico', '54261');

  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const LEAFLET = (E.TRABAJO || '') + 'node_modules/leaflet/dist/';
  let apiRota = false;
  async function contexto(licencia, ancho, nivel) {
    const ctx = await b.newContext({ viewport: { width: ancho || 390, height: 844 } });
    await ctx.route('**/leaflet*.js', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LEAFLET + 'leaflet.js', 'utf8') }));
    await ctx.route('**/leaflet*.css', r => r.fulfill({ contentType: 'text/css', body: fs.readFileSync(LEAFLET + 'leaflet.css', 'utf8') }));
    await ctx.route(/basemaps\.cartocdn\.com/, r => r.fulfill({ contentType: 'image/png', body: PNG1 }));
    await ctx.route(/fonts\.g(oogleapis|static)\.com/, r => r.fulfill({ contentType: 'text/css', body: '' }));
    // El motor real, local: la página habla con api.urbispro.city y acá se
    // le contesta desde localhost. Sin tocar el código de la página.
    await ctx.route('https://api.urbispro.city/**', async r => {
      if (apiRota) return r.abort();
      try { const res = await r.fetch({ url: r.request().url().replace('https://api.urbispro.city', E.MOTOR) }); await r.fulfill({ response: res }); }
      catch (e) { await r.abort(); }
    });
    const pg = await ctx.newPage();
    const errores = [], red = [];
    pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
    pg.on('request', q => red.push(q.url()));
    if (licencia) await pg.addInitScript(l => { try { localStorage.setItem('urbis_vt_licencia', l); } catch (e) {} }, licencia);
    // El nivel de rendimiento se fija por contexto: el Chromium de pruebas
    // declara pocos núcleos y caería a «medio», que apaga el latido a propósito.
    if (nivel) await pg.addInitScript(n => { try { localStorage.setItem('urbis_vt_prefs_v1', JSON.stringify({ nivel: n })); } catch (e) {} }, nivel);
    return { ctx, pg, errores, red };
  }
  const esperar = (pg, ms) => pg.waitForTimeout(ms);

  // ── 1. La página existe y NO es index ──────────────────────────────────
  const A = await contexto(GOB, 390, 'completo');
  const carga = await A.pg.goto(E.ESTATICO + '/vision-territorial.html', { waitUntil: 'domcontentloaded' });
  chk(carga && carga.status() === 200, 'vision-territorial.html existe (' + (carga && carga.status()) + ')');
  // El estado «cargando» se ve ANTES de que llegue nada.
  const cargando = await A.pg.evaluate(() => !!document.querySelector('[data-vt-estado="cargando"], .vt-cargando'));
  chk(cargando, 'la primera pintura es el estado CARGANDO, no una pantalla en blanco');
  await A.pg.waitForFunction(() => window.VT && VT.estado.ses && document.querySelector('.vt-cifra'), null, { timeout: 25000 }).catch(() => {});
  const texto = await A.pg.evaluate(() => document.body.textContent);
  const datos = await A.pg.evaluate(() => ({
    globalesIndex: ['map', 'UrbisMobileAppV58', 'URBIS_AUTH', 'globalData', 'urbisPermisos', 'urbisVisibilidadReporte', 'URBIS_SLOTS'].filter(k => k in window),
    scripts: [...document.scripts].map(s => (s.src || '').split('/').pop().split('?')[0]).filter(Boolean),
    ses: window.VT && VT.estado.ses && VT.estado.ses.rol,
    cifra: (document.querySelector('.vt-cifra') || {}).textContent || '',
    aviso: (document.querySelector('.vt-aviso-datos') || {}).textContent || '',
    tarjetas: document.querySelectorAll('.vt-grid2 .vt-card').length,
    meta: (document.querySelector('.vt-meta') || document.querySelector('.vt-linea') || {}).textContent || ''
  }));
  chk(datos.globalesIndex.length === 0, 'no carga NINGÚN módulo de index: ni mapa, ni auth, ni reportes (' + (datos.globalesIndex.join(', ') || 'ninguno') + ')');
  chk(datos.scripts.every(s => /^(leaflet|00-config|71-iconos-urbis|90-vt-app)/.test(s)), 'sus scripts son solo Leaflet, la configuración, los iconos y el suyo: ' + datos.scripts.join(' '));
  chk(datos.ses === 'gobernante', 'la licencia con territorio y rol abre la sesión (' + datos.ses + ')');
  chk(/\d/.test(datos.cifra), 'la primera pantalla enseña una CIFRA de la ciudad, no «configure su territorio» (' + datos.cifra.trim().slice(0, 12) + ')');
  chk(/desarrollo/i.test(datos.aviso), 'y avisa con todas las letras que son datos de desarrollo');
  chk(/DANE/.test(datos.meta), 'la población dice su fuente (DANE) junto a la cifra');
  chk(!EMOJI.test(texto), 'ni un emoji en toda la pantalla: iconos de línea');

  // ── 2. Sin Apps Script, nunca ──────────────────────────────────────────
  const aScript = A.red.filter(u => /script\.google\.com|sheetdb/i.test(u));
  chk(aScript.length === 0, 'la página no hizo NI UNA petición al Apps Script de los reportes');

  // ── 3. Tablero con análisis: índice, cuatro tarjetas, tres propuestas ──
  // Si no hay análisis (base recién sembrada), se corre uno desde acá.
  const hayAnalisis = await A.pg.evaluate(() => !!(VT.estado.tablero && VT.estado.tablero.analisis));
  if (!hayAnalisis) {
    await A.pg.evaluate(() => { const b = document.querySelector('[data-vt-accion="analizar"]'); if (b) b.click(); });
    await A.pg.waitForFunction(() => VT.estado.tablero && VT.estado.tablero.analisis && document.querySelectorAll('.vt-grid2 .vt-card').length === 4, null, { timeout: 90000 }).catch(() => {});
  }
  const tab = await A.pg.evaluate(() => ({
    indice: (document.getElementById('vt-cifra-indice') || {}).textContent || '',
    tarjetas: [...document.querySelectorAll('.vt-grid2 .vt-card')].map(c => c.className.match(/urg-(\w+)/) && c.className.match(/urg-(\w+)/)[1]),
    props: document.querySelectorAll('#vt-tablero [data-vt-propuesta]').length,
    confianza: (document.querySelector('.vt-linea') || {}).textContent || '',
    ranking: (document.querySelector('.vt-ranking-fila.mio') || {}).textContent || ''
  }));
  chk(/^\d+(,\d)?\s*\/ 100/.test(tab.indice.trim()), 'el índice de salud urbana es la cifra grande, sobre 100 (' + tab.indice.trim() + ')');
  chk(tab.tarjetas.length === 4 && tab.tarjetas.every(u => /critico|medio|atendido/.test(u)), 'cuatro tarjetas de déficit, cada una con su línea de urgencia (' + tab.tarjetas.join(',') + ')');
  chk(tab.props >= 1 && tab.props <= 3, 'de una a tres propuestas prioritarias en el tablero (' + tab.props + ')');
  chk(/ de \d+ equipamientos/.test(tab.confianza), 'la confianza lleva su denominador: «N de M equipamientos»');

  // ── 4. El mapa ─────────────────────────────────────────────────────────
  await A.pg.evaluate(() => VT.ir('mapa'));
  await A.pg.waitForFunction(() => document.querySelectorAll('.vt-eq').length > 0 && VT.estado.capas && VT.estado.capas.deficit.getLayers().length > 0, null, { timeout: 30000 }).catch(() => {});
  /* Las manchas se dibujan en un lienzo (preferCanvas), no como nodos SVG:
     con mil manzanas el lienzo es lo que no traba un teléfono. Se cuentan
     las capas y se mira su definición —sin trazo— y el desenfoque del
     panel donde viven. */
  const mapa1 = await A.pg.evaluate(() => {
    const eq = document.querySelector('.vt-eq svg'); const r = eq && eq.getBoundingClientRect();
    const manchas = VT.estado.capas.deficit.getLayers();
    return {
      eq: document.querySelectorAll('.vt-eq').length, ancho: r ? Math.round(r.width) : 0,
      manchas: manchas.length,
      blur: getComputedStyle(document.querySelector('.vt-pane-deficit')).filter,
      sinBorde: manchas.length > 0 && manchas.every(m => m.options.stroke === false && m.options.interactive === false),
      halosProp: document.querySelectorAll('.vt-prop-marca:not(.decidida) .halo').length,
      halosOtros: document.querySelectorAll('.vt-eq .halo, .vt-pane-deficit .halo').length,
      animacion: (() => { const h = document.querySelector('.vt-prop-marca:not(.decidida) .halo'); return h ? getComputedStyle(h).animationName : ''; })(),
      formas: new Set([...document.querySelectorAll('.vt-eq svg')].map(s => s.innerHTML)).size,
      zoom: VT.estado.mapa.getZoom()
    };
  });
  chk(mapa1.eq > 0, 'los equipamientos del tipo elegido están en el mapa (' + mapa1.eq + ')');
  chk(mapa1.manchas > 0 && /blur/.test(mapa1.blur) && mapa1.sinBorde, 'las manchas de déficit son difusas y sin borde (' + mapa1.manchas + ' · ' + mapa1.blur + ')');
  chk(mapa1.halosProp > 0 && mapa1.halosOtros === 0 && /vtHalo/.test(mapa1.animacion), 'SOLO las propuestas pulsan (' + mapa1.halosProp + ' halos, animación ' + mapa1.animacion + ')');
  // Tamaño fijo: se cambia el zoom y el icono mide lo mismo.
  // Con llaves: setZoom devuelve el mapa entero y eso no se puede serializar.
  await A.pg.evaluate(() => { VT.estado.mapa.setZoom(VT.estado.mapa.getZoom() + 3); });
  await esperar(A.pg, 700);
  const mapa2 = await A.pg.evaluate(() => { const eq = document.querySelector('.vt-eq svg'); const r = eq && eq.getBoundingClientRect(); return { ancho: r ? Math.round(r.width) : 0, zoom: VT.estado.mapa.getZoom() }; });
  chk(mapa1.ancho > 0 && mapa1.ancho === mapa2.ancho, 'los iconos NO crecen con el zoom: ' + mapa1.ancho + ' px en zoom ' + mapa1.zoom + ' y ' + mapa2.ancho + ' px en zoom ' + mapa2.zoom);
  // La misma información como lista, ordenada por urgencia.
  await A.pg.click('#vt-btn-lista'); await esperar(A.pg, 400);
  const lista = await A.pg.evaluate(() => [...document.querySelectorAll('#vt-mapa-lista .vt-fila-detalle')].map(s => parseInt(s.getAttribute('data-sin'), 10)));
  chk(lista.length >= 5 && lista.every((v, i) => i === 0 || lista[i - 1] >= v), 'la vista de lista ordena los tipos por gente sin cobertura, de más a menos (' + lista.slice(0, 3).join(' ≥ ') + '…)');
  await A.pg.click('#vt-btn-lista'); await esperar(A.pg, 300);
  // Evaluar idea: en tres tiempos.
  await A.pg.click('#vt-fab-evaluar'); await esperar(A.pg, 300);
  await A.pg.evaluate(() => { const c = VT.estado.mapa.getCenter(); VT.estado.mapa.fire('click', { latlng: c }); });
  await A.pg.waitForFunction(() => document.querySelectorAll('#vt-hoja-cuerpo .vt-tiempo').length === 3, null, { timeout: 20000 }).catch(() => {});
  const ev = await A.pg.evaluate(() => ({ tiempos: document.querySelectorAll('#vt-hoja-cuerpo .vt-tiempo').length, texto: document.getElementById('vt-hoja-cuerpo').textContent }));
  chk(ev.tiempos === 3 && /Qué encontró/.test(ev.texto) && /Qué recomienda/.test(ev.texto) && /si no se hace/i.test(ev.texto), '«Evaluar idea» contesta en tres tiempos: qué encontró, qué recomienda, qué pasa si no');
  chk(/decisión es de la persona/i.test(ev.texto), 'y recuerda quién decide');

  // ── 5. Propuestas: las dos prioridades, la ficha, decidir ──────────────
  await A.pg.evaluate(() => VT.ir('propuestas'));
  await A.pg.waitForFunction(() => document.querySelectorAll('#vt-propuestas [data-vt-propuesta]').length > 0, null, { timeout: 20000 }).catch(() => {});
  const props = await A.pg.evaluate(() => ({
    n: document.querySelectorAll('#vt-propuestas .vt-card[data-vt-propuesta]').length,
    dos: [...document.querySelectorAll('#vt-propuestas .vt-barra-leyenda')].every(l => /prioridad \d+/.test(l.textContent) && /neutra \d+/.test(l.textContent)),
    id: (document.querySelector('#vt-propuestas .vt-card[data-vt-propuesta]') || {}).getAttribute && document.querySelector('#vt-propuestas .vt-card[data-vt-propuesta]').getAttribute('data-vt-propuesta')
  }));
  chk(props.n >= 1 && props.dos, 'cada propuesta enseña las DOS prioridades, la ajustada y la neutra (' + props.n + ')');
  await A.pg.evaluate(i => VT.ir('propuesta', i), props.id);
  await A.pg.waitForFunction(() => document.querySelectorAll('#vt-propuesta .vt-tiempo').length === 3, null, { timeout: 20000 }).catch(() => {});
  const ficha = await A.pg.evaluate(() => ({
    tiempos: document.querySelectorAll('#vt-propuesta .vt-tiempo').length,
    botones: [...document.querySelectorAll('#vt-propuesta .vt-btn')].map(b => b.textContent.trim()),
    costo: (document.querySelector('#vt-propuesta .vt-card:nth-of-type(3)') || {}).textContent || document.getElementById('vt-propuesta').textContent,
    zona: !!document.querySelector('#vt-ficha-mapa .leaflet-interactive')
  }));
  chk(ficha.tiempos === 3, 'la ficha habla en tres tiempos');
  chk(ficha.botones.some(b => /Aprobar/.test(b)) && ficha.botones.some(b => /Descartar/.test(b)), 'el gobernante ve Aprobar y Descartar (' + ficha.botones.join(' · ') + ')');
  chk(/estimación preliminar/i.test(ficha.costo), 'el costo va etiquetado «estimación preliminar»');
  // Descartar exige motivo: el botón de confirmar no se habilita con menos de 10 caracteres.
  await A.pg.click('[data-vt-accion="descartar"]'); await esperar(A.pg, 300);
  await A.pg.fill('#vt-motivo', 'corto'); await esperar(A.pg, 100);
  const conCorto = await A.pg.evaluate(() => (document.getElementById('vt-conf-ok') || {}).disabled);
  await A.pg.fill('#vt-motivo', 'El predio está en litigio y la comunidad se opone.'); await esperar(A.pg, 100);
  const conLargo = await A.pg.evaluate(() => (document.getElementById('vt-conf-ok') || {}).disabled);
  chk(conCorto === true && conLargo === false, 'descartar no se confirma sin un motivo de al menos 10 caracteres');
  // Una sola capa modal a la vez: con el diálogo abierto, NADA de atrás se
  // alcanza (el botón de ajustes queda debajo del fondo del modal); Escape
  // lo cierra; y abrir ajustes deja exactamente una caja, no dos.
  const tapado = await A.pg.evaluate(() => {
    const b = document.getElementById('vt-btn-ajustes'); const r = b.getBoundingClientRect();
    const encima = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(encima && encima.closest('#vt-modal'));
  });
  await A.pg.keyboard.press('Escape'); await esperar(A.pg, 200);
  const cerrado = await A.pg.evaluate(() => document.getElementById('vt-modal').hidden);
  await A.pg.click('#vt-btn-ajustes'); await esperar(A.pg, 200);
  const capas = await A.pg.evaluate(() => ({ cajas: document.querySelectorAll('.vt-modal-caja').length, esAjustes: /Ajustes/.test(document.getElementById('vt-modal').textContent) }));
  chk(tapado && cerrado && capas.cajas === 1 && capas.esAjustes, 'una sola capa modal a la vez: el diálogo tapa lo de atrás, Escape lo cierra, y ajustes abre una sola caja');
  // Tamaño de letra ajustable.
  await A.pg.evaluate(() => { const b = [...document.querySelectorAll('[data-vt-seg="escala"] button')].find(x => x.getAttribute('data-v') === '1.3'); b && b.click(); });
  await esperar(A.pg, 200);
  const escala = await A.pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--vt-escala').trim());
  chk(escala === '1.3', 'el tamaño de letra se ajusta (--vt-escala = ' + escala + ')');
  await A.pg.evaluate(() => { const b = [...document.querySelectorAll('[data-vt-seg="escala"] button')].find(x => x.getAttribute('data-v') === '1'); b && b.click(); });
  await A.pg.keyboard.press('Escape'); await esperar(A.pg, 200);
  // El atrás vuelve al PADRE (propuestas), no salta al tablero.
  await A.pg.goBack(); await esperar(A.pg, 500);
  const padre = await A.pg.evaluate(() => VT.estado.pantalla);
  chk(padre === 'propuestas', 'desde una ficha, atrás vuelve a Propuestas —su padre—, no al tablero (' + padre + ')');
  const nivel = await A.pg.evaluate(() => document.documentElement.getAttribute('data-vt-nivel'));
  chk(nivel === 'completo', 'el nivel de rendimiento está declarado en <html> y el interruptor manual manda (' + nivel + ')');
  chk(A.errores.length === 0, 'sin errores de página' + (A.errores.length ? ': ' + A.errores[0] : ''));
  await A.ctx.close();

  // ── 6. El veedor: si no puede, el botón NO EXISTE ──────────────────────
  const V = await contexto(VEE);
  await V.pg.goto(E.ESTATICO + '/vision-territorial.html#propuestas', { waitUntil: 'domcontentloaded' });
  await V.pg.waitForFunction(() => document.querySelectorAll('#vt-propuestas [data-vt-propuesta]').length > 0, null, { timeout: 25000 }).catch(() => {});
  const vid = await V.pg.evaluate(() => (document.querySelector('#vt-propuestas .vt-card[data-vt-propuesta]') || { getAttribute: () => null }).getAttribute('data-vt-propuesta'));
  if (vid) { await V.pg.evaluate(i => VT.ir('propuesta', i), vid); await V.pg.waitForFunction(() => document.querySelectorAll('#vt-propuesta .vt-tiempo').length === 3, null, { timeout: 20000 }).catch(() => {}); }
  const veedor = await V.pg.evaluate(() => ({
    botones: [...document.querySelectorAll('#vt-propuesta .vt-btn')].map(b => b.textContent.trim()),
    deshabilitados: document.querySelectorAll('#vt-propuesta .vt-btn[disabled]').length,
    analizar: document.querySelectorAll('[data-vt-accion="analizar"]').length
  }));
  chk(veedor.botones.length === 0 && veedor.deshabilitados === 0, 'el veedor no ve botones de decidir: no existen, ni siquiera deshabilitados');
  chk(veedor.analizar === 0, 'ni el de correr análisis');
  // Rendimiento adaptativo: sin interruptor manual, este Chromium cae a
  // «medio» y el latido se apaga; el halo sigue ahí, quieto. Se degrada, no se quita.
  await V.pg.evaluate(() => VT.ir('mapa'));
  await V.pg.waitForFunction(() => document.querySelector('.vt-prop-marca:not(.decidida) .halo'), null, { timeout: 20000 }).catch(() => {});
  const degradado = await V.pg.evaluate(() => {
    const h = document.querySelector('.vt-prop-marca:not(.decidida) .halo');
    return { nivel: document.documentElement.getAttribute('data-vt-nivel'), halo: !!h, animacion: h ? getComputedStyle(h).animationName : '' };
  });
  chk(degradado.nivel !== 'completo' && degradado.halo && degradado.animacion === 'none',
      'en un equipo modesto el nivel baja solo (' + degradado.nivel + '): el halo se queda, quieto — se degrada, no se quita');
  await V.ctx.close();

  // ── 7. Sin datos y error ───────────────────────────────────────────────
  const Z = await contexto(ZULIA);
  await Z.pg.goto(E.ESTATICO + '/vision-territorial.html#propuestas', { waitUntil: 'domcontentloaded' });
  await Z.pg.waitForFunction(() => document.querySelector('[data-vt-estado="vacio"]') || document.querySelectorAll('#vt-propuestas [data-vt-propuesta]').length > 0, null, { timeout: 25000 }).catch(() => {});
  const vacio = await Z.pg.evaluate(() => { const v = document.querySelector('[data-vt-estado="vacio"]'); return v ? v.textContent : ''; });
  chk(/mancha/i.test(vacio) && !/lo sentimos|disculp/i.test(vacio), 'El Zulia sin análisis: el estado VACÍO explica qué es una propuesta y de dónde sale; no se disculpa');
  apiRota = true;
  await Z.pg.evaluate(() => { localStorage.removeItem('urbis_vt_cache_v1_54261'); VT.estado.tablero = null; VT.ir('tablero'); });
  await Z.pg.waitForFunction(() => document.querySelector('[data-vt-estado="error"]'), null, { timeout: 30000 }).catch(() => {});
  const error = await Z.pg.evaluate(() => { const v = document.querySelector('[data-vt-estado="error"]'); return v ? { texto: v.textContent, boton: !!v.querySelector('[data-vt-accion]') } : null; });
  apiRota = false;
  chk(!!error && /señal|conexión/i.test(error.texto) && error.boton, 'sin servidor y sin caché, el estado ERROR dice qué pasó y ofrece reintentar');
  await Z.ctx.close();

  // ── 8. Aislamiento desde index.html ────────────────────────────────────
  const I = await contexto(null);
  await I.pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(I.pg).catch(() => {});
  const idx = await I.pg.evaluate(() => {
    const antes = (document.querySelector('.u52-screen.active') || {}).dataset;
    const show = (window.UrbisMobileAppV58 && window.UrbisMobileAppV58.show) ? window.UrbisMobileAppV58.show('vt-tablero') : 'sin show';
    const despues = (document.querySelector('.u52-screen.active') || {}).dataset;
    return {
      permitida: typeof window.urbisPantallaPermitida === 'function' ? window.urbisPantallaPermitida('vt-tablero') : null,
      vtDom: document.querySelectorAll('[data-vt-pantalla], #vt-app, .vt-card').length,
      vtGlobal: 'VT' in window,
      show, mismaPantalla: !!antes && !!despues && antes.u52Screen === despues.u52Screen
    };
  });
  chk(idx.permitida === false, "desde ?app=educativo, una pantalla vt-* no está permitida: se rechaza por regla, no por ausencia");
  chk(idx.vtDom === 0 && !idx.vtGlobal, 'y en el DOM de index no existe ni un elemento ni el espacio de nombres del módulo');
  chk(idx.show === false && idx.mismaPantalla, 'show(«vt-tablero») desde el educativo falla y la pantalla que estaba sigue estando (' + idx.show + ')');
  // Una propuesta de Visión Territorial no aparece en los reportes.
  const ids = await I.pg.evaluate(async (a) => {
    try { const r = await fetch(a.motor + '/vt/propuestas', { headers: { Authorization: 'Bearer ' + a.lic } }); const j = await r.json(); return (j.propuestas || []).map(p => p.id); } catch (e) { return []; }
  }, { lic: GOB, motor: E.MOTOR });
  const enIndex = await I.pg.evaluate(ids => {
    const html = document.body.innerHTML; const gd = JSON.stringify(window.globalData || []);
    return ids.filter(i => html.indexOf(i) !== -1 || gd.indexOf(i) !== -1);
  }, ids);
  chk(ids.length > 0 && enIndex.length === 0, 'ninguna de las ' + ids.length + ' propuestas de Visión Territorial aparece en los reportes ni en el educativo');
  // Y ?app=gobierno se va a su página, no enseña la aplicación entera.
  await I.pg.goto(E.ESTATICO + '/index.html?app=gobierno', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await esperar(I.pg, 1500);
  const destino = I.pg.url();
  chk(/vision-territorial\.html/.test(destino), '?app=gobierno lleva a vision-territorial.html, no a la aplicación completa (' + destino.replace(E.ESTATICO, '') + ')');
  await I.ctx.close();

  // ── 9. Un reporte ciudadano no es una propuesta ────────────────────────
  const R = await contexto(GOB);
  await R.pg.addInitScript(() => { try { localStorage.setItem('urbis_vt_marca_prueba', 'REPORTE-CIUDADANO-PRUEBA-XYZ'); } catch (e) {} });
  await R.pg.goto(E.ESTATICO + '/vision-territorial.html#propuestas', { waitUntil: 'domcontentloaded' });
  await R.pg.waitForFunction(() => document.querySelectorAll('#vt-propuestas [data-vt-propuesta]').length > 0, null, { timeout: 25000 }).catch(() => {});
  const cruzado = await R.pg.evaluate(() => {
    // Se inyecta un «reporte» como los de index: si el módulo leyera el
    // almacenamiento de los reportes, aparecería. No aparece.
    window.globalData = [{ tipo: 'Hueco en la vía', descripcion: 'REPORTE-CIUDADANO-PRUEBA-XYZ | x | y', lat: 7.89, lng: -72.5 }];
    try { localStorage.setItem('urbis_reportes_vistos_v1', JSON.stringify({ 'REPORTE-CIUDADANO-PRUEBA-XYZ': 1 })); } catch (e) {}
    VT.estado.propuestas = null; VT.ir('propuestas');
    return new Promise(r => setTimeout(() => r(document.getElementById('vt-propuestas').textContent.indexOf('REPORTE-CIUDADANO-PRUEBA-XYZ') === -1 && document.querySelectorAll('#vt-propuestas [data-vt-propuesta]').length > 0), 2500));
  });
  chk(cruzado === true, 'un reporte ciudadano inyectado no aparece como propuesta ni como intervención');
  const sw = await R.pg.evaluate(async () => { try { const regs = await navigator.serviceWorker.getRegistrations(); return regs.map(r => r.scope.replace(location.origin, '')); } catch (e) { return ['error']; } });
  chk(sw.some(s => /^\/vision-territorial/.test(s)), 'el service worker propio está registrado con su ámbito (' + sw.join(', ') + ')');
  await R.ctx.close();

  await b.close();
  console.log('\nVisión Territorial\n');
  ok.forEach(t => console.log('  ✓ ' + t));
  fallo.forEach(t => console.log('  ✗ ' + t));
  console.log('\n  ' + ok.length + ' en verde, ' + fallo.length + ' en rojo.\n');
  process.exit(fallo.length ? 1 : 0);
})().catch(e => { console.error('La suite se cayó: ' + (e.stack || e.message)); process.exit(1); });
