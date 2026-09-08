const E = require('../entorno.js');
/* EL PUNTAJE SE FIRMA (js/12 + Apps Script)

   Hasta la v820, `set_puntaje` tomaba `usuario` y `puntos` del cuerpo de la
   petición y los escribía. Sin token, sin comprobar nada. Con la consola del
   navegador abierta —o con un `curl` de tres líneas— cualquiera se ponía
   999.999 puntos en un evento de Juegos URBIS, que reparte DINERO REAL, y
   encima podía ponérselos a nombre de otro. La tabla que decide quién cobra
   la escribía quien quisiera.

   Esta suite fija las cuatro reglas del arreglo:

   · el cliente manda el token de sesión en TODA llamada del juego, y ya no
     manda el `usuario`: quién puntúa lo decide el servidor leyendo el token;
   · un puntaje rechazado se DICE en la pantalla de resultado. En un evento
     con premio, creer que tu partida quedó registrada cuando no quedó es
     peor que haberla perdido;
   · un administrador puede corregir o borrar un puntaje, porque `set_puntaje`
     nunca baja uno y sin esto una tabla envenenada no se arregla: se
     abandona;
   · y esa ✏️ NO la ve un jugador cualquiera.

   El servidor vive en un Apps Script que no se puede correr desde acá, así
   que su mitad se comprueba leyendo el archivo: que la función pida el
   token, que saque el usuario de ahí y no del cuerpo, y que la corrección
   exija ser administrador.                                                */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const path = require('path');
const REPO = process.env.REPO || E.RAIZ;
/* El Apps Script NO vive en el repositorio: lleva dentro el id de la hoja de
   cálculo, que es la base de datos entera. Así que esta suite lo busca donde
   pueda estar y, si no lo encuentra, lo DICE y se salta esa mitad en vez de
   fallar: una prueba que falla por un archivo que a propósito no está enseña
   a ignorar la salida.

   Para comprobarlo de verdad: URBIS_GS=/ruta/al/Codigo.gs node pruebas/correr.js tpuntaje */
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

  // ── 1 · El cliente: el token viaja, el usuario no ──────────────────────
  const j12 = fs.readFileSync(REPO + '/js/12-spa-ui.js', 'utf8');
  chk(/_juegoAPI[\s\S]{0,600}?session_token: token/.test(j12),
      'toda llamada del juego lleva el token de sesión');
  chk(/action:'set_puntaje', juego:juegoId, puntos:best/.test(j12),
      'y set_puntaje YA NO manda el usuario: lo decide el servidor leyendo el token');
  chk(!/action:'set_puntaje', usuario:/.test(j12),
      'no queda ninguna llamada vieja mandando el usuario a mano');
  /* El `.catch(()=>{})` de antes se tragaba el rechazo del servidor: la
     partida se veía guardada aunque no lo estuviera. Se mira SOLO la llamada
     que guarda una partida (`puntos:best`) y no cualquier `set_puntaje`: la
     subida de arranque del arcade sí puede fallar callada, porque se
     reintenta sola al volver a abrirlo, y prohibirla ahí sería exigir un
     aviso que no le sirve a nadie. */
  const guardaPartida = (j12.match(/action:'set_puntaje', juego:juegoId, puntos:best \}\)[\s\S]{0,700}?\.catch\([^\n]*\);/) || [''])[0];
  chk(guardaPartida.length > 0, 'la llamada que guarda la partida se puede leer entera');
  chk(/urbisUltimoPuntajeError/.test(guardaPartida) && !/\.catch\(\(\)\s*=>\s*\{\}\)/.test(guardaPartida),
      'un puntaje rechazado deja el motivo escrito en vez de perderse en un catch vacío');
  chk(/out\.ok === false/.test(guardaPartida),
      'y un `ok:false` del servidor cuenta como fallo: contestar no es lo mismo que aceptar');
  chk(/gt-guardado/.test(j12) && /⚠️/.test(j12),
      'y la pantalla de resultado lo muestra con su aviso');

  // ── 2 · El servidor: la firma y la corrección ──────────────────────────
  let gs = '';
  try { gs = GS ? fs.readFileSync(GS, 'utf8') : ''; } catch (e) { gs = ''; }
  if (!gs) {
    console.log('  – el Apps Script no está en esta máquina: su mitad no se comprueba');
  } else {
    const setP = (gs.match(/function setPuntaje_\(body\)\s*\{[\s\S]*?\n\}/) || [''])[0];
    chk(/_quienEscribe_\(body\)/.test(setP),
        'setPuntaje_ exige el token de sesión antes de escribir nada');
    chk(/quien\.usuarioReal/.test(setP),
        'y el usuario sale del token, con el nombre tal como está en la hoja');
    chk(!/body\.usuario|body\.user\b/.test(setP),
        'el cuerpo de la petición ya no decide a nombre de quién se puntúa');
    /* `usuarioReal` y no el normalizado: `normUser_` borra la ñ y las tildes,
       así que escribir el normalizado abriría una fila nueva para «Peña»
       —«pea»— y el jugador saldría dos veces en el ranking. */
    chk(/usuarioReal: String\(r\.usuario \|\| ''\)\.trim\(\)/.test(gs),
        'el token trae el nombre sin normalizar: un «Peña» no se parte en dos renglones');

    const ajP = (gs.match(/function ajustarPuntaje_\(body\)\s*\{[\s\S]*?\n\}/) || [''])[0];
    chk(ajP.length > 0, 'existe la corrección de un puntaje');
    chk(/quien\.esAdmin \|\| quien\.esDueno/.test(ajP),
        'y solo la puede hacer un administrador, demostrado con el token y no dicho');
    chk(/setValue\(puntos\)/.test(ajP) && /deleteRow/.test(ajP),
        'la corrección FIJA el puntaje (puede bajarlo) o borra el renglón: es lo contrario de set_puntaje');
    chk(/action === 'ajustar_puntaje'/.test(gs), 'la acción está enrutada en doPost');
  }

  // ── 3 · La ✏️ solo la ve un administrador ──────────────────────────────
  await pg.setContent('<style>' + fs.readFileSync(REPO + '/css/01-base-layout.css', 'utf8') +
    '</style><div id="urbis-game-tap"><div id="board"></div></div>');
  const vista = await pg.evaluate((src) => {
    // El módulo entero no carga fuera de la aplicación; se extrae la función
    // que pinta la tabla, que es lo que esta prueba mide.
    /* Contra una versión sin la firma, la suite tiene que INFORMAR y no
       reventar: un fallo que se ve como una caída de node no dice cuál regla
       se perdió. La tabla vieja se llamaba `_aureaBoardHTML(tabla)`, sin el
       evento, así que ni siquiera casa el patrón. */
    const m = src.match(/function _aureaBoardHTML\(tabla, juegoId\)\{[\s\S]*?\n  \}/);
    if (!m) return { jugador: -1, admin: -1, sinJuego: -1, llevaUsuario: false };
    const cuerpo = m[0];
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    window._escJuego = esc;
    window.urbisUsuarioActual = () => 'ana';
    const hacer = new Function('_escJuego', 'return (' + cuerpo.replace('function _aureaBoardHTML', 'function') + ')')(esc);
    const tabla = [{ usuario: 'beto', puntos: 999999 }, { usuario: 'ana', puntos: 47 }];
    window.urbisEsAdmin = () => false;
    const jugador = hacer(tabla, 'ev1');
    window.urbisEsAdmin = () => true;
    const admin = hacer(tabla, 'ev1');
    const sinJuego = hacer(tabla, '');
    return {
      jugador: (jugador.match(/gt-aurea-fix/g) || []).length,
      admin: (admin.match(/gt-aurea-fix/g) || []).length,
      sinJuego: (sinJuego.match(/gt-aurea-fix/g) || []).length,
      llevaUsuario: /data-u="beto"/.test(admin)
    };
  }, j12);
  chk(vista.jugador === 0, 'un jugador no ve ningún botón de corregir');
  chk(vista.admin === 2 && vista.llevaUsuario,
      'un administrador ve una ✏️ por renglón, cada una con su usuario');
  chk(vista.sinJuego === 0 && vista.admin > 0, 'y sin evento no se ofrece corregir nada');

  // ── 4 · El texto escapa ────────────────────────────────────────────────
  const inyecta = await pg.evaluate((src) => {
    const m = src.match(/function _aureaBoardHTML\(tabla, juegoId\)\{[\s\S]*?\n  \}/);
    if (!m) return { crudo: true, imgs: -1 };
    const cuerpo = m[0];
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    window.urbisUsuarioActual = () => 'ana';
    window.urbisEsAdmin = () => true;
    const hacer = new Function('_escJuego', 'return (' + cuerpo.replace('function _aureaBoardHTML', 'function') + ')')(esc);
    const html = hacer([{ usuario: '<img src=x onerror=alert(1)>', puntos: 5 }], 'ev1');
    document.getElementById('board').innerHTML = html;
    return { crudo: html.indexOf('<img src=x') !== -1,
             imgs: document.querySelectorAll('#board img').length };
  }, j12);
  chk(!inyecta.crudo && inyecta.imgs === 0,
      'un nombre de usuario con HTML adentro no se ejecuta en la tabla del premio');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
