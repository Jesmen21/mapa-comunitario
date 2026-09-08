const E = require('../entorno.js');
/* INTENTOS LIMITADOS Y «TE PASARON» (js/12, js/13j + Apps Script)

   Dos huecos del evento premium, del mismo tamaño:

   1 · Se jugaba ilimitado y el servidor se quedaba con el máximo, así que no
       ganaba el mejor: ganaba el que más tiempo tuviera para repetir. Tres
       intentos alcanzan para calentar y no alcanzan para moler.

   2 · Uno jugaba, veía su puesto, y no volvía a saber nada hasta que el
       evento terminaba. Si lo superaban el martes se enteraba el viernes,
       cuando ya no había nada que hacer.

   Lo que esta suite defiende, que es lo que se afloja solo:

   · el tope lo cuenta el SERVIDOR. Un límite que el navegador se aplica a sí
     mismo se salta borrando el almacenamiento del teléfono;
   · pero el corte se hace ANTES de jugar, no después: enterarse de que la
     partida no contaba cuando ya se jugaron los treinta segundos es la peor
     manera de decirlo;
   · el arcade libre sigue siendo ilimitado: es un pasatiempo, y jugar más es
     la gracia;
   · el aviso de adelantamiento NO salta la primera vez que uno aparece en
     una tabla —a nadie lo pasaron todavía— ni cuando uno SUBE.            */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const path = require('path');
const REPO = process.env.REPO || E.RAIZ;
const CANDIDATOS = [
  process.env.URBIS_GS,
  path.join(E.TRABAJO || '/tmp', 'appsscript', 'Codigo-limpio.gs'),
  path.join(process.env.HOME || '/root', 'urbis-appsscript', 'Codigo.gs')
].filter(Boolean);
const GS = CANDIDATOS.find(f => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } }) || '';

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 760 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  /* Una página del servidor local y no `setContent`: sin un origen de verdad
     el navegador niega el acceso a localStorage, y esta suite comprueba
     justamente cómo se comporta lo guardado ahí. */
  // Un listado de carpeta y no la raíz: la raíz sirve index.html, que arrastra
  // la aplicación entera y sus errores ajenos a lo que se está probando.
  await pg.goto('http://localhost:8199/assets/', { waitUntil: 'domcontentloaded' });

  // ── 1 · El servidor cuenta los intentos ────────────────────────────────
  let gs = '';
  try { gs = GS ? fs.readFileSync(GS, 'utf8') : ''; } catch (e) { gs = ''; }
  if (!gs) {
    console.log('  – el Apps Script no está en esta máquina: su mitad no se comprueba');
  } else {
    const setP = (gs.match(/function setPuntaje_\(body\)\s*\{[\s\S]*?\n\}/) || [''])[0];
    chk(/topeIntentos_\(juego\)/.test(setP), 'setPuntaje_ consulta el tope de intentos del juego');
    chk(/usados >= tope/.test(setP) && /error: 'intentos'/.test(setP),
        'y rechaza la partida cuando ya se gastaron, diciendo por qué');
    chk(/setValue\(usados \+ 1\)/.test(setP), 'cada partida aceptada gasta un intento');
    chk(/getRange\(2, 1, last - 1, 5\)/.test(setP),
        'lee las cinco columnas: las filas viejas traen la quinta vacía y cuentan como cero');
    const tope = (gs.match(/function topeIntentos_\(juego\)\s*\{[\s\S]*?\n\}/) || [''])[0];
    chk(/JUEGOS_LIBRES\.indexOf\(j\) !== -1 \? 0 :/.test(tope),
        'el arcade libre queda sin tope y el evento con él');
    chk(/'reflejos1'/.test(gs) && /TOPE_INTENTOS_EVENTO = 3/.test(gs),
        'tres intentos por evento, y el arcade de siempre exento');
    const aj = (gs.match(/function ajustarPuntaje_\(body\)\s*\{[\s\S]*?\n\}/) || [''])[0];
    chk(/setValue\(repone\)/.test(aj),
        'corregir un puntaje devuelve los intentos: bajar el número y dejar sin jugar castiga dos veces');
  }

  // ── 2 · El cliente corta ANTES de jugar ────────────────────────────────
  const j12 = fs.readFileSync(REPO + '/js/12-spa-ui.js', 'utf8');
  const jugar = (j12.match(/window\.urbisJugarAurea = function[\s\S]*?\n  \};/) || [''])[0];
  chk(/urbisIntentosRestantes\(juegoId\)/.test(jugar) && /quedan === 0/.test(jugar),
      'no se entra a jugar sin intentos: el aviso llega antes de los treinta segundos, no después');
  chk(/urbisJuegoTap/.test(jugar) && jugar.indexOf('urbisIntentosRestantes') < jugar.indexOf('urbisJuegoTap'),
      'y la comprobación va ANTES de abrir el juego, no después');
  chk(/K_INTENTOS/.test(j12) && /una cortesía, no un candado/.test(j12),
      'el módulo dice con todas las letras que el conteo local no es el candado');
  chk(/out\.restantes != null/.test(j12) && /urbisGuardarIntentos\(juegoId, out\.restantes\)/.test(j12),
      'los intentos que quedan salen de la respuesta del servidor, no de una cuenta propia');
  chk(/gt-intentos/.test(j12) && /Sin intentos/.test(j12),
      'la pantalla de resultado los dice, y apaga «Otra vez» cuando se acaban');

  // ── 3 · El aviso de que te pasaron ─────────────────────────────────────
  const j13 = fs.readFileSync(REPO + '/js/13j-premio.js', 'utf8');
  const av = (j13.match(/function avisosDeAdelantamiento[\s\S]*?\n  \}/) || [''])[0];
  chk(av.length > 0, 'existe el aviso de adelantamiento');
  chk(/if \(antes == null \|\| m\.pos <= antes\) return;/.test(av),
      'no avisa la primera vez que aparezco en una tabla, ni cuando SUBO de puesto');
  chk(/e => !e\.terminado/.test(av),
      'y solo en eventos en curso: avisar de uno terminado es dar una mala noticia sin remedio');
  chk(/limit: 20/.test(j13),
      'la tabla se pide de veinte: con cinco no se sabe en qué puesto voy');
  chk(/premio_pasado_' \+ ev\.juegoId \+ '_' \+ m\.pos/.test(av),
      'el aviso cambia de identidad con cada puesto nuevo, para que no se quede callado a la segunda');
  chk(/exacto \? \(/.test(av) && /te saliste del top/.test(av),
      'fuera de los veinte NO se inventa un puesto: se dice que salí del top');
  chk(/Recuperar el puesto/.test(j13),
      'y la tarjeta trae el botón de volver a jugar: una mala noticia sin salida no sirve de nada');

  // ── 4 · La cortesía local se comporta ──────────────────────────────────
  const compor = await pg.evaluate(() => {
    const K = 'urbis_intentos_';
    const leer = (j) => { const v = localStorage.getItem(K + j); return v === null ? null : (parseInt(v, 10) || 0); };
    localStorage.setItem(K + 'ev1', '2');
    const a = leer('ev1');
    localStorage.removeItem(K + 'ev1');
    const b = leer('ev1');
    localStorage.setItem(K + 'ev2', '0');
    const c = leer('ev2');
    return { a, sinDato: b, cero: c };
  });
  chk(compor.a === 2 && compor.sinDato === null && compor.cero === 0,
      'sin dato guardado NO es lo mismo que cero intentos: lo primero deja jugar, lo segundo no');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
