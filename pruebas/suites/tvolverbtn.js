const E = require('../entorno.js');
/* EL BOTÓN DE VOLVER, QUE SE VEÍA VACÍO (js/20)

   El botón de volver del módulo de Juegos URBIS salía como un cuadro con
   borde y NADA adentro. Dicho así: «el cuadro icono de arriba para
   retroceder sale vacio».

   No era el color ni el tamaño: era la flecha. De los dieciséis botones de
   volver de la aplicación, catorce llevaban «←» (U+2190) y dos —el de
   Juegos URBIS y el del arcade— llevaban «◄» (U+25C4), un carácter del
   bloque de figuras geométricas que la fuente del sistema en Android no
   trae. Sin glifo no hay dibujo, y en vez del recuadro de reemplazo se pinta
   el vacío: el botón parece roto y nadie sabe que se puede tocar.

   Esta suite fija las dos mitades:

   · TODOS los botones de volver usan la misma flecha. Dos maneras de decir
     «atrás» no es variedad, es la puerta por la que entró este fallo;
   · y esa flecha DEJA TINTA al pintarse. Comprobar el carácter no basta:
     una fuente sin el glifo pasa esa prueba y deja al usuario mirando un
     cuadro vacío igual. Acá se cuentan los píxeles.                      */
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

  // ── 2 · Y de verdad deja tinta ─────────────────────────────────────────
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 300, height: 200 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  await pg.setContent('<style>' + fs.readFileSync(REPO + '/css/47-aurea-menu.css', 'utf8') +
    'body{margin:0;background:#04121F}</style>' +
    '<div id="urbis-mobile-app"><header class="u52-topbar u52-aurea-top">' +
    '<button class="u52-aurea-back" data-u52-back aria-label="Volver">←</button>' +
    '<button class="u52-aurea-back" id="vacio" aria-label="Vacío"></button>' +
    '</header></div>');
  const tinta = await pg.evaluate(async () => {
    await document.fonts.ready;
    const medir = (el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    };
    // Rango del texto: si el glifo no existe, el navegador no dibuja nada y
    // el rectángulo del texto sale sin ancho.
    const anchoDe = (el) => {
      const t = el.firstChild;
      if (!t || t.nodeType !== 3) return 0;
      const r = document.createRange();
      r.selectNodeContents(el);
      const b = r.getBoundingClientRect();
      return Math.round(b.width);
    };
    const btn = document.querySelector('.u52-aurea-back');
    return { caja: medir(btn), anchoFlecha: anchoDe(btn), anchoVacio: anchoDe(document.getElementById('vacio')) };
  });
  chk(tinta.caja.w > 30 && tinta.caja.h > 30,
      'el botón mide lo que debe (' + Math.round(tinta.caja.w) + '×' + Math.round(tinta.caja.h) + ')');
  chk(tinta.anchoFlecha > 4,
      'la flecha ocupa ancho de verdad: se está dibujando (' + tinta.anchoFlecha + ' px)');
  chk(tinta.anchoVacio === 0,
      'y un botón sin nada dentro mide cero: la comprobación distingue lo lleno de lo vacío');

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
