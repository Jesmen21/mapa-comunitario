const E = require('../entorno.js');
/* EL CALENDARIO DE RANGO DEL EVENTO PREMIUM (js/82)

   Hasta la v818, publicar un torneo de Juegos URBIS pedía «¿en cuántas HORAS
   termina la competencia?». Nadie organiza así: se piensa «del viernes al
   domingo», y traducirlo a 72 obliga a abrir el calendario del teléfono y
   contar. Un día de más o de menos cierra la competencia antes de tiempo, y
   el premio es dinero real.

   Esta suite fija lo que el calendario tiene que cumplir para que ese error
   deje de ser posible:

   · un rango de días se convierte en horas SIN que el usuario cuente, y la
     cuenta cae en el último minuto del último día, no en el primero;
   · elegir «hoy» arranca AHORA y no a las 00:00: un evento publicado a las
     tres de la tarde no lleva vivo desde la madrugada;
   · el rango no se puede dar vuelta ni estirar sin límite;
   · un inicio futuro se avisa en pantalla, porque el evento no aparece en el
     mapa hasta su día y quien no lo sepa lo publica dos veces.           */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const REPO = process.env.REPO || E.RAIZ;

// Un martes cualquiera, a las 15:00 hora de Colombia (20:00 UTC).
const AHORA = Date.UTC(2026, 8, 8, 20, 0, 0);

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 760 }, timezoneId: 'America/Bogota' });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  /* Contra una versión sin el calendario, la suite tiene que INFORMAR y no
     reventar: un fallo que se ve como una caída de node no dice cuál regla
     se perdió. */
  const leerSiEsta = f => { try { return fs.readFileSync(REPO + f, 'utf8'); } catch (e) { return ''; } };
  await pg.setContent('<style>' + leerSiEsta('/css/82-calendario.css') + '</style><div id="caja"></div>');
  try { await pg.addScriptTag({ path: REPO + '/js/82-calendario.js' }); } catch (e) {}

  const hay = await pg.evaluate(() => !!(window.URBIS_CALENDARIO && window.URBIS_CALENDARIO.montar));
  chk(hay, 'el calendario existe y se puede montar');
  if (!hay) {
    console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
    console.log('\n  ✗ el calendario existe y se puede montar\n  ✗ sin módulo no se puede seguir');
    console.log('\n  ' + ok.length + '/2');
    await b.close(); process.exit(1);
  }

  await pg.evaluate((AHORA) => {
    window.__ahora = AHORA;
    URBIS_CALENDARIO.configurar({ ahora: () => window.__ahora });
    window.__ctrl = URBIS_CALENDARIO.montar(document.getElementById('caja'), { meses: 3 });
  }, AHORA);

  // ── 1 · Al abrirlo ya hay algo elegido ─────────────────────────────────
  const ini = await pg.evaluate(() => {
    const v = window.__ctrl.valor();
    return { horas: v.horas, dias: v.dias, inicio: v.inicio.toISOString(), fin: v.fin.toISOString(),
             patas: [...document.querySelectorAll('.urb-cal-pata b')].map(x => x.textContent.trim()),
             activa: (document.querySelector('.urb-cal-pata.activa') || {}).getAttribute
               ? document.querySelector('.urb-cal-pata.activa').getAttribute('data-pata') : '' };
  });
  chk(ini.dias === 1 && ini.patas.length === 2,
      'abre con un rango de un día ya puesto: nunca hay que elegir para poder publicar');
  chk(ini.activa === 'inicio', 'y esperando el día en que EMPIEZA, que es lo primero que se decide');
  // 15:00 → 23:59:59 del mismo día = 8h59m, que se redondea hacia arriba a 9.
  chk(ini.horas === 9, 'un evento de hoy dura hasta el final de hoy: 9 horas desde las 3 de la tarde');
  chk(ini.inicio.indexOf('2026-09-08T20:00') === 0,
      'y arranca AHORA, no a las 00:00: un evento publicado a las 3 no lleva vivo desde la madrugada');
  chk(ini.fin.indexOf('2026-09-09T04:59') === 0,
      'la cuenta cae en el último minuto del último día (23:59 en Colombia)');

  // ── 2 · Elegir un rango, como en la aerolínea ──────────────────────────
  const toca = f => pg.click('.urb-cal-dia[data-fecha="' + f + '"]');
  await toca('2026-9-11');   // empieza el viernes
  await toca('2026-9-13');   // termina el domingo
  const r = await pg.evaluate(() => {
    const v = window.__ctrl.valor();
    return { dias: v.dias, horas: v.horas, inicio: v.inicio.toISOString(), fin: v.fin.toISOString(),
             texto: window.__ctrl.texto(),
             entre: document.querySelectorAll('.urb-cal-dia.entre').length,
             marcados: [...document.querySelectorAll('.urb-cal-dia.inicio, .urb-cal-dia.fin')].map(x => x.textContent) };
  });
  chk(r.dias === 3 && r.horas === 72,
      'del viernes 11 al domingo 13 son 3 días y 72 horas, sin que nadie cuente');
  chk(r.inicio.indexOf('2026-09-11T05:00') === 0 && r.fin.indexOf('2026-09-14T04:59') === 0,
      'empieza a las 00:00 del 11 y termina a las 23:59 del 13, hora de Colombia');
  chk(r.entre === 1 && String(r.marcados) === '11,13',
      'el tramo se pinta como en la aerolínea: las dos puntas marcadas y el día de en medio resaltado');
  chk(/del 11 de septiembre al 13 de septiembre/.test(r.texto),
      'y el texto que leerá el jugador dice los dos días con todas las letras: ' + r.texto);

  // Un solo día no se dice «del 15 al 15».
  await toca('2026-9-15'); await toca('2026-9-15');
  const uno = await pg.evaluate(() => ({ t: window.__ctrl.texto(), d: window.__ctrl.valor().dias }));
  chk(uno.d === 1 && !/del .* al /.test(uno.t),
      'una competencia de un solo día se dice como un día, no «del 15 al 15»: ' + uno.t);

  // ── 3 · El rango no se puede dar vuelta ni estirar ─────────────────────
  await toca('2026-9-20'); await toca('2026-9-14');   // final ANTES del inicio
  const vuelta = await pg.evaluate(() => {
    const s = window.__ctrl.dias();
    return { inicio: s.inicio.getDate(), fin: s.fin.getDate(), dias: window.__ctrl.valor().dias };
  });
  chk(vuelta.inicio === 14 && vuelta.fin === 14 && vuelta.dias === 1,
      'tocar un día anterior al inicio no deja un rango al revés: se entiende como querer empezar antes');

  const tope = await pg.evaluate(() => URBIS_CALENDARIO.MAX_DIAS_RANGO);
  /* El día que se toca tiene que EXISTIR en la rejilla: con tres meses
     pintados, un 20 de diciembre no está y el clic no ocurre — la prueba
     pasaría sin haber probado nada. El 30 de noviembre sí está, y desde el 10
     de septiembre son 82 días, bastante más que el tope. */
  await toca('2026-9-10');
  const existeLejano = await pg.evaluate(() => !!document.querySelector('.urb-cal-dia[data-fecha="2026-11-30"]'));
  chk(existeLejano, 'el calendario llega hasta noviembre: hay dónde probar un rango largo de verdad');
  await toca('2026-11-30');
  const largo = await pg.evaluate(() => ({ dias: window.__ctrl.valor().dias,
                                           fin: window.__ctrl.dias().fin.toDateString() }));
  chk(largo.dias === tope,
      'un rango de 82 días se recorta exactamente al tope de ' + tope + ' en vez de guardarse (quedó en ' + largo.dias + ')');

  // ── 4 · El pasado no se puede elegir ───────────────────────────────────
  const pasado = await pg.evaluate(() => {
    const b = document.querySelector('.urb-cal-dia[data-fecha="2026-9-5"]');
    return b ? { existe: true, apagado: b.disabled } : { existe: false };
  });
  chk(pasado.existe && pasado.apagado, 'los días ya pasados están apagados: no se puede programar hacia atrás');
  const hoyMarcado = await pg.evaluate(() =>
    (document.querySelector('.urb-cal-dia.hoy') || {}).textContent);
  chk(hoyMarcado === '8', 'hoy va marcado, para saber desde dónde se está contando');

  // ── 5 · Un inicio futuro se avisa ──────────────────────────────────────
  await toca('2026-9-11'); await toca('2026-9-12');
  const aviso = await pg.evaluate(() => {
    const p = document.querySelector('.urb-cal-aviso');
    return p ? p.textContent : '';
  });
  chk(/no aparece en el mapa/.test(aviso),
      'un evento programado avisa que no se verá hasta su día: sin eso se publica dos veces');
  await toca('2026-9-8'); await toca('2026-9-9');
  const sinAviso = await pg.evaluate(() => !document.querySelector('.urb-cal-aviso'));
  chk(sinAviso, 'y si empieza hoy no hay nada que avisar');

  // ── 6 · La ventana propia, para los flujos sin sitio donde montarlo ────
  const modal = await pg.evaluate(async () => {
    const p = URBIS_CALENDARIO.pedirRango({ titulo: '📅 Prueba' });
    await new Promise(r => setTimeout(r, 30));
    const abierta = !!document.querySelector('.urb-cal-fondo .urb-cal-dia');
    document.querySelector('.urb-cal-cancelar').click();
    const v = await p;
    return { abierta, valor: v, cerrada: !document.querySelector('.urb-cal-fondo') };
  });
  chk(modal.abierta && modal.valor === null && modal.cerrada,
      'la ventana propia se abre, y cancelar devuelve null sin dejar nada colgado');

  // ── 7 · La estética: celeste URBIS, no verde ───────────────────────────
  const css = leerSiEsta('/css/82-calendario.css');
  const verdes = (css.match(/#[0-9a-fA-F]{6}/g) || []).filter(h => {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), bl = parseInt(h.slice(5, 7), 16);
    return g > r + 25 && g > bl + 25;   // verde de verdad: el canal verde manda sobre los dos
  });
  chk(css.length > 0 && verdes.length === 0, 'ni un color verde en el calendario' + (verdes.length ? ': ' + verdes.join(', ') : ''));
  ['#7FD8F5', '#0B5E86', '#0EA5E9'].forEach(c => {
    chk(css.indexOf(c) !== -1, 'usa el ' + c + ' del compositor premium, no una paleta inventada');
  });

  /* ── 8 · Dos trampas que ya mordieron una vez ─────────────────────────
     La primera: el calendario iba envuelto en un <label>. Un <label>
     reenvía el clic a su primer control etiquetable, y los días SON
     <button>, así que cada toque contaba dos veces y el rango se elegía
     solo. La segunda: `:hover:not([disabled])` pesa más que
     `.urb-cal-dia.inicio`, así que el día recién tocado perdía su degradado
     justo mientras se miraba. Las dos se vieron mirando la pantalla, no
     leyendo el código, y por eso quedan escritas acá. */
  const j20 = leerSiEsta('/js/20-mobile-functional-app.js');
  chk(!/<label[^>]*u52-ev-fechas/.test(j20),
      'el calendario del compositor NO va dentro de un <label>: duplicaría cada toque');
  chk(/<div class="u52-ev-fechas">/.test(j20) && /id="ev-calendario"/.test(j20),
      'y sí está montado en el compositor de Juegos URBIS');
  chk(!/#ev-horas|u52-ev-horas/.test(j20),
      'el campo viejo de «Termina en (horas)» ya no existe: dos maneras de decir lo mismo se contradicen');

  // El día elegido conserva su degradado con el puntero encima.
  await toca('2026-9-17');
  await pg.hover('.urb-cal-dia[data-fecha="2026-9-17"]');
  const fondoHover = await pg.evaluate(() =>
    getComputedStyle(document.querySelector('.urb-cal-dia[data-fecha="2026-9-17"]')).backgroundImage);
  chk(/gradient/.test(fondoHover),
      'el día elegido conserva su degradado con el puntero encima, en vez de apagarse');

  /* Y una vuelta completa, con el ratón fuera, elige el rango que se tocó.
     El toque del 17 de arriba dejó a medias un rango —el calendario está
     esperando el final—, así que primero se cierra: si no, el par siguiente
     arranca desfasado y la prueba mediría otra cosa. */
  await toca('2026-9-17');
  await pg.mouse.move(2, 2);
  await toca('2026-9-21'); await toca('2026-9-24');
  const dosVueltas = await pg.evaluate(() => {
    const s = window.__ctrl.dias();
    return s.inicio.getDate() + '->' + s.fin.getDate() + ' (' + window.__ctrl.valor().dias + ')';
  });
  chk(dosVueltas === '21->24 (4)',
      'tocar 21 y luego 24 deja el rango 21→24 de 4 días, ni uno solo ni al revés (quedó ' + dosVueltas + ')');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
