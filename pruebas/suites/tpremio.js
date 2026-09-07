const E = require('../entorno.js');
/* EL PREMIO DE LOS JUEGOS URBIS (js/13j): qué pasa cuando alguien gana.

   Hasta la v792, nada. El hub decía «Ganador: @x» y el popup prometía que
   URBIS contactaría al ganador; ninguna de las dos cosas movía un dedo. Esta
   suite recorre el camino entero con un backend de mentira que contesta por
   acción —hoja, tabla del evento, chat— y anota lo que la aplicación le
   escribe:

   · Como GANADORA (@vecina, #1 de un evento premium ya terminado): la
     campanita dice «¡Ganaste!» con botón de reclamar; reclamar escribe la
     fila compartida «🏆 Premio URBIS» (lat 0 / lng 0, sin marcador), manda
     el primer mensaje al chat de la cuenta administradora y abre ese chat
     con el banner del premio. El hub del evento terminado enseña el bloque
     de ganadora. El evento premium EN VIVO sale primero en Eventos, con su
     tarjeta celeste: premio en grande, cuenta regresiva y botón de entrar.
   · Como ADMINISTRADOR (@jefe), con un reclamo pendiente en la hoja: la
     campanita lo cuenta y lo enseña como «Premio por pagar» con chat,
     ranking y Atender; atender pone la fila en «en-pago» con su nombre y
     escribe al ganador; marcar pagado la cierra. Un reclamo cuyo ganador NO
     coincide con la tabla del servidor sale con la alerta y sin Atender.
   · Las filas de premio nunca llegan al mapa ni a «mis reportes».           */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');

// ── La hoja de mentira ────────────────────────────────────────────────────
// Misma disposición que escribe urbisCrearEventoPremiumEn (js/12): 6 campos,
// 37 usos, 8 de identidad, y los cinco temporales en BASE_OFFSET+8.
const USOS = 37;
const hora = h => new Date(Date.now() + h * 3600000);
function eventoPremium(lat, lng, titulo, premio, creado, expira) {
  const finTxt = expira.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const notas = `EVENTO_URBIS · PREMIUM · Premio: ${premio} · Detalle: Reto de reflejos: el que más puntos haga gana · Hora: termina ${finTxt} · Lugar: Juegos URBIS URBIS`;
  const arr = ['✨ Juegos URBIS', titulo, notas, 'Bueno', 'Activo', 'N/A']
    .concat(Array(USOS).fill('NO'))
    .concat(['N/A', 'Aprobado', 'jefe', 'admin', 0, 'admin@urbis.com', 'ADMIN', 'Comunidad']);
  arr[51] = creado.toISOString(); arr[52] = expira.toISOString(); arr[53] = 'Temporal'; arr[54] = 'Activo'; arr[55] = '✨';
  return { tipo: '🎪 Eventos Comunitarios', lat: lat, lng: lng, descripcion: arr.join(' | '), fecha: creado.toISOString() };
}
const TERMINADO = eventoPremium('4.6101234', '-74.0700001', 'Reto Chapinero', '100.000 COP', hora(-50), hora(-26));
const VIVO      = eventoPremium('4.6205678', '-74.0800002', 'Reto Usaquén',   '50.000 COP',  hora(-2),  hora(20));
const JUEGO_TERMINADO = 'aurea_46101234';
const JUEGO_VIVO = 'aurea_46205678';
const reclamo = (ganador, estado, admin) => ({
  tipo: '🏆 Premio URBIS', lat: '0', lng: '0',
  descripcion: [ganador, JUEGO_TERMINADO, 'Reto Chapinero', '100.000 COP', estado, admin || '', new Date().toISOString(), '40 pts'].join('~~~'),
  fecha: new Date().toISOString()
});
const TABLAS = {
  [JUEGO_TERMINADO]: [{ usuario: 'vecina', puntos: 40 }, { usuario: 'otro', puntos: 22 }],
  [JUEGO_VIVO]: [{ usuario: 'otro', puntos: 15 }]
};

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });

  // El backend de mentira: contesta por acción y anota lo que le escriben.
  function backend(filas) {
    const escrito = { db_write: [], db_update: [], chat_send: [] };
    const rutas = async (ctx) => {
      await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
      await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
        r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
                    body: fs.readFileSync(E.TRABAJO + 'node_modules/leaflet/dist/' + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js')) }); });
      await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.Chart=window.Chart||function(){};' }));
      await ctx.route(/basemaps\.cartocdn\.com|arcgisonline\.com|maptiles\.arcgis\.com|mt\d\.google\.com\/vt/,
        r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
      await ctx.route(/script\.google\.com/, r => {
        let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
        const a = body.action || '';
        let out = { ok: true };
        if (a === 'db_read') out = { ok: true, data: filas.slice() };
        else if (a === 'leaderboard') out = { ok: true, juego: body.juego, tabla: TABLAS[body.juego] || [] };
        else if (a === 'db_write') { escrito.db_write.push(body.fila); filas.push(body.fila); out = { ok: true, row: filas.length + 1 }; }
        else if (a === 'db_update') {
          escrito.db_update.push(body);
          filas.forEach(f => { if (String(f[body.col]) === String(body.value)) Object.assign(f, body.set); });
          out = { ok: true, updated: 1 };
        }
        else if (a === 'chat_send') { escrito.chat_send.push(body); out = { ok: true }; }
        else if (a === 'chat_fetch') out = { ok: true, mensajes: [] };
        else if (a === 'chat_inbox') out = { ok: true, conversaciones: [] };
        else if (a === 'social_notifications') out = { ok: true, notifications: [] };
        else if (a === 'perm_mine') out = { ok: true, permisos: [], es_admin: filas.__admin === true, es_dueno: false };
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
      });
    };
    return { rutas, escrito };
  }
  const movil = { serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
                  viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  async function abrir(usuario, rol, filas) {
    const ctx = await b.newContext(movil);
    await ctx.addInitScript(([u, r]) => {
      if (window.top !== window) return;
      try {
        localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: u, rol: r, session_token: 't', active: true, verified: true }));
        localStorage.setItem('urbisUserRole', r);
      } catch (e) {}
    }, [usuario, rol]);
    const be = backend(filas);
    await be.rutas(ctx);
    const pg = await ctx.newPage();
    const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
    await pg.goto(E.ESTATICO + '/index.html?app=ciudadano', { waitUntil: 'commit' }).catch(() => {});
    await E.esperarLaApp(pg, 30000).catch(() => {});
    // Hasta que la hoja de mentira haya llegado al mapa.
    // globalData es un `let` global: no cuelga de window, se lee por nombre.
    await pg.waitForFunction(() => { try { return Array.isArray(globalData) && globalData.length > 0; } catch (e) { return false; } }, null, { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    return { ctx, pg, err, escrito: be.escrito, filas };
  }
  const ir = async (pg, pantalla) => { await pg.evaluate(p => window.UrbisMobileAppV58.show(p), pantalla); await pg.waitForTimeout(900); };
  // Un clic sobre algo que no existe (código viejo) es una aserción fallida,
  // no una prueba muerta a mitad de camino.
  const clic = (pg, sel) => pg.evaluate(s => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);

  // ═══ 1 · La ganadora ═══════════════════════════════════════════════════
  const filasA = [TERMINADO, VIVO];
  const A = await abrir('vecina', 'citizen', filasA);

  const capa = await A.pg.evaluate(([jt, jv]) => {
    const P = window.URBIS_PREMIO;
    const gd = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
    const meta = gd.map(p => ({ tipo: p.tipo, arch: obtenerMetaTemporal(p).archivado }));
    return {
      hayModulo: !!P,
      eventos: P ? P.eventos().map(e => e.juegoId + ':' + (e.terminado ? 'fin' : 'vivo') + ':' + e.premio) : [],
      terminados: P ? P.terminados().map(e => e.juegoId) : [],
      meta: meta,
      enMapa: gd.filter(p => /premio urbis/i.test(p.tipo)).length,
      esMeta: typeof window.esFilaMetaUrbis === 'function' && window.esFilaMetaUrbis({ tipo: '🏆 Premio URBIS' }),
      aureaNo: typeof window.urbisEsEventoAurea === 'function' && !window.urbisEsEventoAurea({ tipo: '🏆 Premio URBIS', descripcion: 'x~~~aurea_1~~~evento premium' })
    };
  }, [JUEGO_TERMINADO, JUEGO_VIVO]);
  console.log('\n── La hoja de mentira, leída por la app ─────────────');
  console.log('  ' + capa.eventos.join(' · '));
  chk(capa.hayModulo, 'el módulo del premio está cargado (js/13j)');
  chk(capa.eventos.includes(JUEGO_TERMINADO + ':fin:100.000 COP') && capa.eventos.includes(JUEGO_VIVO + ':vivo:50.000 COP'),
      'los dos eventos premium se leen con su estado y su premio');
  chk(capa.terminados.length === 1 && capa.terminados[0] === JUEGO_TERMINADO, 'solo el vencido cuenta como terminado reciente');
  chk(capa.esMeta && capa.aureaNo, 'una fila de premio es fila interna: ni reporte ni gota de evento');

  // La campanita: ganaste.
  await ir(A.pg, 'notifications');
  await A.pg.waitForTimeout(1500);
  const notiA = await A.pg.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#u52-noti-list .u52-noti-card'));
    const premio = cards.find(c => c.classList.contains('premio'));
    const badge = document.getElementById('u52-noti-badge');
    return { total: cards.length, primeraEsPremio: !!(cards[0] && cards[0].classList.contains('premio')),
             txt: premio ? premio.innerText : '', reclamar: !!(premio && premio.querySelector('[data-premio-accion="reclamar"]')),
             ranking: !!(premio && premio.querySelector('[data-premio-accion="ranking"]')),
             badge: badge ? badge.textContent : '', badgeOculto: badge ? badge.hidden : true };
  });
  console.log('\n── La ganadora, en la campanita ─────────────────────');
  console.log('  ' + notiA.txt.replace(/\n/g, ' · ').slice(0, 160));
  chk(notiA.primeraEsPremio, 'el aviso del premio va PRIMERO en la campanita');
  chk(/Ganaste/.test(notiA.txt) && /Reto Chapinero/.test(notiA.txt) && /100\.000 COP/.test(notiA.txt),
      'dice que ganó, qué evento y cuánto');
  chk(/40 pts/.test(notiA.txt), 'y con cuántos puntos quedó #1');
  chk(notiA.reclamar && notiA.ranking, 'con botón de reclamar y de ver el ranking');

  // Reclamar.
  chk(await clic(A.pg, '[data-premio-accion="reclamar"]'), 'se puede tocar «Reclamar premio»');
  await A.pg.waitForTimeout(2500);
  const tras = await A.pg.evaluate(() => {
    const chat = document.getElementById('urbis-chat-ov');
    const banner = chat && chat.querySelector('[data-premio-banner]');
    return { chatAbierto: !!chat, con: chat ? (chat.querySelector('div div div:nth-child(2)') || {}).textContent || chat.innerText.slice(0, 80) : '',
             banner: banner ? banner.innerText : '', filas: (window.urbisPremiosFilas || []).length };
  });
  const escritoA = A.escrito;
  const filaEscrita = escritoA.db_write[0] || {};
  const campos = String(filaEscrita.descripcion || '').split('~~~');
  console.log('\n── Reclamar ─────────────────────────────────────────');
  console.log('  fila: ' + String(filaEscrita.descripcion || '').slice(0, 110));
  console.log('  chat: ' + (escritoA.chat_send[0] ? '@' + escritoA.chat_send[0].para + ' ← ' + escritoA.chat_send[0].texto.slice(0, 90) : '(nada)'));
  chk(escritoA.db_write.length === 1 && filaEscrita.tipo === '🏆 Premio URBIS' && filaEscrita.lat === '0' && filaEscrita.lng === '0',
      'reclamar escribe UNA fila «🏆 Premio URBIS» en lat 0 / lng 0');
  chk(campos[0] === 'vecina' && campos[1] === JUEGO_TERMINADO && campos[2] === 'Reto Chapinero' && campos[3] === '100.000 COP' && campos[4] === 'reclamado',
      'con ganadora, evento, título, premio y estado «reclamado»');
  chk(escritoA.chat_send.length === 1 && escritoA.chat_send[0].para === 'urbisadmin' && escritoA.chat_send[0].de === 'vecina' &&
      /Reclamo del premio/.test(escritoA.chat_send[0].texto) && /Reto Chapinero/.test(escritoA.chat_send[0].texto),
      'y manda el primer mensaje al chat de la cuenta administradora');
  chk(tras.chatAbierto && /@urbisadmin/.test(tras.con), 'abre el chat con la administración');
  chk(/Chat del premio/.test(tras.banner) && /Reto Chapinero/.test(tras.banner) && /Reclamado/.test(tras.banner),
      'y el chat lleva el banner del premio: evento, estado');
  await A.pg.evaluate(() => { const c = document.getElementById('urbis-chat-back'); if (c) c.click(); });
  await A.pg.waitForTimeout(600);

  // La campanita ahora dice el estado, y el hub del evento terminado, también.
  await ir(A.pg, 'notifications');
  await A.pg.waitForTimeout(1200);
  const estadoA = await A.pg.evaluate(() => {
    const premio = document.querySelector('#u52-noti-list .u52-noti-card.premio');
    return { txt: premio ? premio.innerText : '', chat: !!(premio && premio.querySelector('[data-premio-accion="chat"]')),
             reclamar: !!(premio && premio.querySelector('[data-premio-accion="reclamar"]')) };
  });
  chk(/Tu premio/.test(estadoA.txt) && /Reclamado/i.test(estadoA.txt) && estadoA.chat && !estadoA.reclamar,
      'después del reclamo, la campanita muestra el estado con el chat del premio y ya sin «reclamar»');

  await A.pg.evaluate(j => { if (window.urbisAbrirAureaModulo) window.urbisAbrirAureaModulo(j, 'Reto Chapinero', '100.000 COP', 'ayer', true); }, JUEGO_TERMINADO);
  await A.pg.waitForTimeout(1800);
  const hubA = await A.pg.evaluate(() => {
    const c = document.getElementById('u52-aurea-content');
    const bloque = c && c.querySelector('.premio-hub');
    const prize = c && c.querySelector('.ah-prize-grande b');
    const tam = el => el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    const titulo = c && c.querySelector('.ah-evtitle');
    return { bloque: bloque ? bloque.innerText : '', chips: c ? c.querySelectorAll('.ah-chip').length : 0,
             premioPx: tam(prize), tituloPx: tam(titulo), ganador: (c && c.querySelector('.am-winner') || {}).textContent || '' };
  });
  console.log('\n── El hub del evento terminado ──────────────────────');
  console.log('  ' + hubA.bloque.replace(/\n/g, ' · '));
  chk(/Tu premio/.test(hubA.bloque) && /Reclamado/.test(hubA.bloque), 'el hub enseña a la ganadora el estado de su premio');
  chk(/@vecina/.test(hubA.ganador), 'y sigue diciendo quién ganó');
  chk(hubA.premioPx > hubA.tituloPx * 1.5, 'el premio es la cifra grande del hub (' + hubA.premioPx + ' px vs título ' + hubA.tituloPx + ' px)');
  chk(hubA.chips >= 2, 'con las fichas de cuándo termina, cuántos compiten y mi mejor (' + hubA.chips + ')');
  await A.pg.screenshot({ path: '/tmp/premio-hub.png' });

  // Eventos: la tarjeta premium en vivo, primero y dorada.
  await A.pg.evaluate(() => { document.body.classList.remove('urbis-aurea-full'); });
  await ir(A.pg, 'events');
  await A.pg.waitForTimeout(1500);
  const evA = await A.pg.evaluate(() => {
    const lista = document.querySelector('#u52-eventos-content .ev-movil-list');
    const cards = lista ? Array.from(lista.children) : [];
    const prem = cards[0];
    const premio = prem && prem.querySelector('.ev-premium-premio b');
    const tam = el => el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    const bg = prem ? getComputedStyle(prem).backgroundImage : '';
    return { n: cards.length, primeraPremium: !!(prem && prem.classList.contains('ev-premium-evento')),
             txt: prem ? prem.innerText : '', premioPx: tam(premio), tituloPx: tam(prem && prem.querySelector('.ev-premium-titulo')),
             oscura: /gradient/.test(bg), cta: !!(prem && prem.querySelector('[data-premio-accion="abrir"]')),
             porConfirmar: /por confirmar/i.test(prem ? prem.innerText : '') };
  });
  console.log('\n── Eventos ──────────────────────────────────────────');
  console.log('  ' + evA.txt.replace(/\n/g, ' · ').slice(0, 170));
  chk(evA.primeraPremium, 'el evento premium en vivo va primero en Eventos, con su tarjeta propia');
  chk(/50\.000 COP/.test(evA.txt) && /Termina en|Faltan/.test(evA.txt) && /Reto Usaquén/.test(evA.txt),
      'con el premio, la cuenta regresiva y el nombre');
  chk(!evA.porConfirmar, 'y ya no dice «Fecha por confirmar · Hora por confirmar»');
  chk(evA.premioPx > evA.tituloPx && evA.oscura && evA.cta, 'el premio es lo grande, la tarjeta es la celeste oscura y tiene botón de entrar');
  chk(await clic(A.pg, '[data-premio-accion="abrir"]'), 'se puede tocar el botón de la tarjeta premium');
  await A.pg.waitForTimeout(1200);
  const abrio = await A.pg.evaluate(() => (document.querySelector('.u52-screen.active') || {}).getAttribute('data-u52-screen'));
  chk(abrio === 'aurea', 'el botón de la tarjeta entra al hub del evento (' + abrio + ')');
  await A.pg.evaluate(() => { document.body.classList.remove('urbis-aurea-full'); });
  await ir(A.pg, 'events');
  await A.pg.waitForTimeout(800);
  await A.pg.screenshot({ path: '/tmp/premio-eventos.png' });
  await ir(A.pg, 'notifications');
  await A.pg.waitForTimeout(800);
  await A.pg.screenshot({ path: '/tmp/premio-noti-ganadora.png' });
  chk(A.err.length === 0, 'sin errores de página (ganadora)' + (A.err.length ? ': ' + A.err[0] : ''));
  await A.ctx.close();

  // ═══ 2 · El administrador ═════════════════════════════════════════════
  const filasB = [TERMINADO, VIVO, reclamo('vecina', 'reclamado', ''), reclamo('tramposo', 'reclamado', '')];
  filasB.__admin = true;
  const B = await abrir('jefe', 'admin', filasB);
  await ir(B.pg, 'notifications');
  await B.pg.waitForTimeout(1800);
  const notiB = await B.pg.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#u52-noti-list .u52-noti-card.premio'));
    const badge = document.getElementById('u52-noti-badge');
    return cards.map(c => ({ txt: c.innerText, cls: c.className,
      atender: !!c.querySelector('[data-premio-accion="atender"]'), chat: !!c.querySelector('[data-premio-accion="chat"]'),
      ranking: !!c.querySelector('[data-premio-accion="ranking"]'), alerta: !!c.querySelector('.premio-alerta') }))
      .concat([{ badge: badge ? badge.textContent : '', oculto: badge ? badge.hidden : true }]);
  });
  const pagar = notiB.filter(x => x.cls && /premio-pagar/.test(x.cls));
  const bueno = pagar.find(x => /@vecina/.test(x.txt));
  const malo = pagar.find(x => /@tramposo/.test(x.txt));
  const badgeB = notiB[notiB.length - 1];
  console.log('\n── El administrador, en la campanita ────────────────');
  pagar.forEach(x => console.log('  ' + x.txt.replace(/\n/g, ' · ').slice(0, 150)));
  chk(pagar.length === 2, 've cada reclamo pendiente como «Premio por pagar» (' + pagar.length + ')');
  chk(!!bueno && bueno.atender && bueno.chat && bueno.ranking && !bueno.alerta,
      'el reclamo de la ganadora real trae chat, ranking y Atender, sin alerta');
  chk(!!malo && malo.alerta && !malo.atender && /otro ganador/.test(malo.txt),
      'el reclamo que no coincide con la tabla sale con alerta y SIN botón de atender');
  chk(!badgeB.oculto && parseInt(badgeB.badge, 10) >= 2, 'y la campanita los cuenta mientras estén pendientes (' + badgeB.badge + ')');
  const chip = await B.pg.evaluate(() => { const em = document.querySelector('#u52-noti-list .u52-noti-card.premio .premio-estado'); if (!em) return ''; const cs = getComputedStyle(em); return (cs.webkitTextFillColor && cs.webkitTextFillColor !== 'rgba(0, 0, 0, 0)') ? cs.webkitTextFillColor : cs.color; });
  chk(chip === 'rgb(11, 94, 134)', 'la píldora de estado va en el azul del premio, no en el verde agua de las demás tarjetas (' + chip + ')');
  await B.pg.screenshot({ path: '/tmp/premio-noti-admin.png' });

  // Atender.
  chk(await B.pg.evaluate(() => {
    const c = Array.from(document.querySelectorAll('.u52-noti-card.premio')).find(x => /@vecina/.test(x.innerText));
    const b = c && c.querySelector('[data-premio-accion="atender"]'); if (b) b.click(); return !!b;
  }), 'se puede tocar «Atender» en el reclamo de la ganadora');
  await B.pg.waitForTimeout(2500);
  const upd = B.escrito.db_update[0] || {};
  const nuevo = String((upd.set || {}).descripcion || '').split('~~~');
  const msg = B.escrito.chat_send[0] || {};
  const chatB = await B.pg.evaluate(() => {
    const chat = document.getElementById('urbis-chat-ov');
    const banner = chat && chat.querySelector('[data-premio-banner]');
    const lum = c => { const m = String(c).match(/\d+(\.\d+)?/g) || [0, 0, 0]; const f = v => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]); };
    const contraste = (el) => { if (!el) return 0; const cs = getComputedStyle(el); const fill = cs.webkitTextFillColor && cs.webkitTextFillColor !== 'rgba(0, 0, 0, 0)' ? cs.webkitTextFillColor : cs.color; let n = el, bg = 'rgba(0, 0, 0, 0)'; while (n && n !== document.body) { const b = getComputedStyle(n).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) { bg = b; break; } const bi = getComputedStyle(n).backgroundImage; if (bi && bi !== 'none') { bg = 'rgb(255, 240, 200)'; break; } n = n.parentElement; } const a = lum(fill), c = lum(bg); return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05); };
    return { abierto: !!chat, banner: banner ? banner.innerText : '', botonBanner: !!(banner && banner.querySelector('[data-premio-accion="pagado"]')),
             contrasteSmall: contraste(banner && banner.querySelector('small')),
             contrasteChip: (function(){ const em = document.querySelector('#u52-noti-list .u52-noti-card.premio .premio-estado'); return contraste(em); })() };
  });
  console.log('\n── Atender ──────────────────────────────────────────');
  console.log('  update: ' + nuevo.slice(0, 6).join(' ~ '));
  console.log('  chat: @' + (msg.para || '?') + ' ← ' + String(msg.texto || '').slice(0, 100));
  chk(upd.col === 'descripcion' && nuevo[4] === 'en-pago' && nuevo[5] === 'jefe' && nuevo[0] === 'vecina',
      'atender pone la fila en «en-pago» con el nombre del administrador');
  chk(msg.para === 'vecina' && msg.de === 'jefe' && /soy @jefe/.test(msg.texto) && /Nequi|Daviplata|cuenta/.test(msg.texto),
      'y le escribe a la ganadora preguntando el medio de pago');
  chk(chatB.abierto && /En pago/.test(chatB.banner) && /atiende @jefe/.test(chatB.banner) && chatB.botonBanner,
      'abre el chat con el banner en «En pago» y el botón de marcar pagado');
  chk(chatB.contrasteSmall >= 4.5, 'el detalle del banner se lee sobre el crema (contraste ' + chatB.contrasteSmall.toFixed(1) + ':1)');
  await B.pg.screenshot({ path: '/tmp/premio-chat-admin.png' });

  // Pagado, desde el banner del chat.
  B.pg.once('dialog', d => d.accept());
  chk(await clic(B.pg, '[data-premio-banner] [data-premio-accion="pagado"]'), 'se puede marcar pagado desde el banner del chat');
  await B.pg.waitForTimeout(2500);
  const upd2 = B.escrito.db_update[1] || {};
  const fin = String((upd2.set || {}).descripcion || '').split('~~~');
  const msg2 = B.escrito.chat_send[1] || {};
  chk(fin[4] === 'pagado' && fin[5] === 'jefe', 'marcar pagado cierra la fila (' + fin[4] + ')');
  chk(msg2.para === 'vecina' && /pagado/i.test(msg2.texto), 'y avisa a la ganadora por el mismo chat');
  await B.pg.evaluate(() => { const c = document.getElementById('urbis-chat-back'); if (c) c.click(); });
  await ir(B.pg, 'notifications');
  await B.pg.waitForTimeout(1200);
  const despues = await B.pg.evaluate(() => Array.from(document.querySelectorAll('.u52-noti-card.premio-pagar')).map(c => c.innerText));
  chk(despues.length === 1 && /@tramposo/.test(despues[0]), 'el premio pagado sale de la lista de por pagar; queda el dudoso');
  chk(B.err.length === 0, 'sin errores de página (administrador)' + (B.err.length ? ': ' + B.err[0] : ''));
  await B.ctx.close();

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
