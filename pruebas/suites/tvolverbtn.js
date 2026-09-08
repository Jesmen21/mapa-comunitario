const E = require('../entorno.js');
/* EL BOTÓN DE VOLVER, QUE SE VEÍA VACÍO (js/20, css/72)

   El botón de volver salía como un cuadro con borde y NADA adentro. Dicho
   así: «el cuadro icono de arriba para retroceder sale vacio».

   La primera vez se buscó la causa en el CARÁCTER: dos de los dieciséis
   botones llevaban «◄» (U+25C4) en vez de «←», y ese sí es un carácter que
   la fuente del sistema en Android no siempre trae. Se igualaron los
   dieciséis, se probó cargando la hoja del módulo (css/47), dio verde… y el
   botón seguía saliendo en blanco en el teléfono.

   La causa era otra, y estaba en OTRA hoja. La capa de diseño del modo
   educativo apagaba el texto de TODO botón de volver:

       #urbis-mobile-app .u52-topbar [data-u52-back]{ font-size:0 !important; }

   esperando un SVG que se inyectó en tres botones y en los otros TRECE nunca
   llegó: el mapa, eventos, notificaciones, alertas, deportes, social, la
   línea de tiempo, Juegos URBIS… trece cuadros con borde y nada adentro. No
   parecen botones apagados: parecen rotos, y nadie los toca.

   De ahí las dos lecciones que esta suite fija:

   · el texto solo se apaga donde HAY un dibujo que lo reemplace (`:has(svg)`);
   · y se mide sobre la PÁGINA COMPLETA, no sobre la hoja de un módulo. Una
     comprobación de estilo que carga una hoja suelta no comprueba estilo:
     comprueba una intención. El estilo es lo que gana en la cascada con todas
     las hojas puestas — que es exactamente lo que esta suite no vio la
     primera vez.                                                          */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  // ── 1 · Una sola flecha para «atrás» ───────────────────────────────────
  const j20 = fs.readFileSync(REPO + '/js/20-mobile-functional-app.js', 'utf8');
  const flechas = [...j20.matchAll(/data-u52-back[^>]*>([^<]*)</g)].map(m => m[1]);
  chk(flechas.length >= 10, 'se encontraron los botones de volver (' + flechas.length + ')');
  const distintas = [...new Set(flechas)];
  chk(distintas.length === 1,
      'todos los botones de volver usan la MISMA flecha' +
      (distintas.length === 1 ? ' (' + distintas[0] + ')'
        : ': ' + distintas.map(f => f + ' = U+' + f.codePointAt(0).toString(16).toUpperCase()).join(', ')));
  chk(distintas[0] === '←',
      'y esa flecha es «←» (U+2190), la que la fuente del sistema sí trae');
  chk(j20.indexOf('◄') === -1,
      'no queda ni un «◄» (U+25C4) en la aplicación: es el que salía en blanco');

  /* ── 2 · Y de verdad se dibujan, en la PÁGINA COMPLETA ────────────────
     Esta suite ya existió una vez cargando solo la hoja del módulo
     (css/47), y dio verde mientras el botón seguía saliendo en blanco en el
     teléfono. La causa estaba en OTRA hoja: la capa de diseño del modo
     educativo apagaba el texto de todo botón de volver con
     `font-size:0 !important`, esperando un SVG que se inyectó en tres
     botones y en los otros trece nunca llegó.

     Una comprobación de estilo que carga una hoja suelta no comprueba
     estilo: comprueba una intención. El estilo es lo que gana en la cascada
     con TODAS las hojas puestas, así que se abre la página de verdad y se
     miden los dieciséis botones. */
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 760 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  /* Leaflet se sirve desde una CDN que este entorno no alcanza, y sin él
     js/03 revienta en la primera línea y arrastra a media aplicación:
     `dimensiones`, `map`, `BASE_OFFSET`… una cascada de errores que no son
     del sitio. Se sirve la copia local en su lugar, para que la página cargue
     como carga en un teléfono y cualquier error que quede SÍ sea suyo. */
  const LEAFLET = (E.TRABAJO || '') + 'node_modules/leaflet/dist/';
  await pg.route('**/leaflet*.js', r => r.fulfill({ contentType: 'application/javascript',
    body: fs.readFileSync(LEAFLET + 'leaflet.js', 'utf8') }));
  await pg.route('**/leaflet*.css', r => r.fulfill({ contentType: 'text/css',
    body: fs.readFileSync(LEAFLET + 'leaflet.css', 'utf8') }));
  await pg.goto('http://localhost:8199/index.html', { waitUntil: 'load' });
  await pg.waitForTimeout(1800);
  const botones = await pg.evaluate(async () => {
    await document.fonts.ready;
    /* Se lee el ESTILO CALCULADO y no el rectángulo dibujado. Las pantallas
       están ocultas hasta que se abren, y forzarlas visibles a todas a la vez
       crea un estado que la aplicación nunca tiene —se probó, y disparó
       código de otras pantallas—. El defecto que se persigue no necesita
       dibujo: es un tamaño de letra en cero sin dibujo que lo reemplace, y
       eso se lee igual con el elemento oculto. */
    return [...document.querySelectorAll('#urbis-mobile-app [data-u52-back]')].map(x => {
      const p = x.closest('[data-u52-screen]');
      const cs = getComputedStyle(x);
      return { pantalla: p ? p.getAttribute('data-u52-screen') : '—',
               fs: parseFloat(cs.fontSize) || 0,
               svg: !!x.querySelector('svg'),
               texto: (x.textContent || '').trim(),
               w: parseFloat(cs.width) || 0, h: parseFloat(cs.height) || 0 };
    });
  });
  chk(botones.length >= 10, 'se encontraron los botones de volver en la página real (' + botones.length + ')');
  /* Un botón «vale» si tiene un dibujo O si su texto ocupa ancho. Cuadro con
     borde y nada adentro no es un botón apagado: parece roto, y nadie lo
     toca. */
  const ciegos = botones.filter(x => !x.svg && (x.fs < 4 || !x.texto));
  chk(ciegos.length === 0,
      'ninguno sale vacío' + (ciegos.length ? ': ' + ciegos.map(x => x.pantalla).join(', ') : ' (' + botones.length + ' revisados)'));
  const chicos = botones.filter(x => x.w > 0 && (x.w < 28 || x.h < 28));
  chk(chicos.length === 0,
      'y todos son bastante grandes para tocarlos con el dedo' +
      (chicos.length ? ': ' + chicos.map(x => x.pantalla + ' ' + x.w + '×' + x.h).join(', ') : ''));
  /* La regla que los apagaba sigue existiendo, y debe: donde SÍ hay dibujo,
     el texto sobra. Lo que no puede volver es apagarlo a ciegas. */
  const css72 = fs.readFileSync(REPO + '/css/72-edu-diseno.css', 'utf8');
  chk(/\[data-u52-back\]:has\(svg\)\{ font-size:0/.test(css72),
      'el texto solo se apaga donde hay un dibujo que lo reemplace');
  chk(!/\[data-u52-back\]\{ font-size:0/.test(css72),
      'y ya no se apaga a ciegas');

  // ── 3 · El rótulo de la partida no habla de plata ──────────────────────
  /* Con el marcador y el cronómetro al lado, «· POR DINERO» dejaba la franja
     de arriba hablando de plata mientras el jugador está jugando. Cuánto se
     lleva el #1 se dice donde toca decidir —la tarjeta del evento y el hub,
     con la cifra al lado—, no encima de la partida. */
  const j12 = fs.readFileSync(REPO + '/js/12-spa-ui.js', 'utf8');
  const franja = (j12.match(/<div class="gt-top">\$\{premium[^\n]*/) || [''])[0];
  chk(/gt-premium-tag">✨ JUEGOS URBIS</.test(franja),
      'la franja de la partida dice solo «JUEGOS URBIS»');
  chk(!/DINERO|dinero/.test(franja),
      'y no menciona el dinero encima del marcador y el cronómetro');
  /* Y de la interfaz ENTERA, no solo de la franja. Repetir «dinero real» en
     el globo del mapa, en la tarjeta, en el héroe, en la tarjeta del juego y
     en el aviso —cinco veces, con la cifra al lado cada vez— se lee como
     insistir en que sí, que de verdad, que no es mentira. Se dijo así: «se
     siente muy migajero». La cifra dice lo que hay que decir; el resto era
     ansiedad. Lo que NO se toca son los comentarios del código, que explican
     por qué la firma del puntaje importa: prohibir nombrarlo ahí empujaría a
     borrar la explicación, que es la trampa de la v815. */
  const SERVIDOS = ['js/09-events.js', 'js/10-visible-markers.js', 'js/12-spa-ui.js',
                    'js/13j-premio.js', 'js/20-mobile-functional-app.js'];
  const sinComentarios = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, '')      // bloques
    .replace(/^\s*\/\/.*$/gm, '');           // líneas
  const conPlata = SERVIDOS.filter(f =>
    /dinero real|POR DINERO|por dinero/.test(sinComentarios(fs.readFileSync(REPO + '/' + f, 'utf8'))));
  chk(conPlata.length === 0,
      'ningún texto de pantalla repite «dinero real»' + (conPlata.length ? ': ' + conPlata.join(', ') : ''));
  /* Pero el premio SIGUE dicho donde se decide entrar: la cifra, con «El #1
     se lleva» delante. Quitar eso también sería esconder lo que el evento
     promete, que es lo contrario de lo que se pidió. */
  chk(/El #1 se lleva/.test(j12) && /El #1 se lleva/.test(fs.readFileSync(REPO + '/js/13j-premio.js', 'utf8')),
      'la cifra del premio sigue en el héroe y en la tarjeta del evento');
  /* Y las reglas de estilo de la etiqueta que se quitó no se quedan
     rondando: CSS muerto es CSS que alguien vuelve a usar sin saber. */
  const css47 = fs.readFileSync(REPO + '/css/47-aurea-menu.css', 'utf8');
  const css48 = fs.readFileSync(REPO + '/css/48-premio.css', 'utf8');
  chk(!/\.ah-prize span\{/.test(css47) && !/\.ev-premium-premio span\{/.test(css48),
      'y el estilo de la etiqueta que se quitó no quedó rondando en el CSS');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
